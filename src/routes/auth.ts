import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { redis } from "@/lib/redis";
import { sql } from "@/db";
import { signJwt } from "@/lib/jwt";
import { rateLimitMiddleware } from "@/middleware/ratelimit";

const app = new Hono();
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

app.post(
  "/tecnico",
  rateLimitMiddleware(10, 60),
  zValidator("json", z.object({ codigo: z.string().regex(/^\d{5}$/) })),
  async (c) => {
    const { codigo } = c.req.valid("json");

    const [tecnico] = await sql`
      SELECT id, nombre, correo, activo, fecha_limite, estado_corte
      FROM tecnicos
      WHERE codigo_acceso = ${codigo} AND activo = true
      LIMIT 1
    `;

    if (!tecnico) {
      return c.json({ error: "Código inválido o expirado" }, 401);
    }

    const fechaLimiteVencida = tecnico.fecha_limite
      ? new Date(tecnico.fecha_limite).getTime() < Date.now()
      : false;
    const corteAplicado = tecnico.estado_corte && tecnico.estado_corte !== "en_servicio";

    if (fechaLimiteVencida || corteAplicado) {
      return c.json({ error: "periodo_vencido" }, 401);
    }

    const token = await signJwt({ sub: tecnico.id, nombre: tecnico.nombre, rol: "tecnico" });

    await redis.setex(
      `session:${token}`,
      SESSION_TTL_SECONDS,
      JSON.stringify({
        sub: tecnico.id,
        nombre: tecnico.nombre,
        rol: "tecnico",
      })
    );

    return c.json({
      token,
      tecnico: { id: tecnico.id, nombre: tecnico.nombre },
    });
  }
);

export default app;
