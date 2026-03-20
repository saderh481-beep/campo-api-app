import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { redis } from "@/lib/redis";
import { sql } from "@/db";
import { signJwt } from "@/lib/jwt";
import { rateLimitMiddleware } from "@/middleware/ratelimit";

const app = new Hono();

app.post(
  "/tecnico",
  rateLimitMiddleware(10, 60),
  zValidator("json", z.object({ codigo: z.string().min(5).max(5) })),
  async (c) => {
    const { codigo } = c.req.valid("json");

    const tecnicoId = await redis.get(`tech:${codigo.toUpperCase()}`);
    if (!tecnicoId) {
      return c.json({ error: "Código inválido o expirado" }, 401);
    }

    const [tecnico] = await sql`
      SELECT id, nombre FROM tecnicos WHERE id = ${tecnicoId} AND activo = true
    `;
    if (!tecnico) {
      return c.json({ error: "Técnico no encontrado o inactivo" }, 401);
    }

    const token = await signJwt({ sub: tecnico.id, nombre: tecnico.nombre });

    return c.json({
      token,
      tecnico: { id: tecnico.id, nombre: tecnico.nombre },
    });
  }
);

export default app;
