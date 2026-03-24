import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sql } from "@/db";
import { signJwt } from "@/lib/jwt";
import { rateLimitMiddleware } from "@/middleware/ratelimit";

const app = new Hono();

app.post(
  "/tecnico",
  rateLimitMiddleware(10, 60),
  zValidator("json", z.object({ codigo: z.string().min(5).max(10) })),
  async (c) => {
    const { codigo } = c.req.valid("json");

    // Query usuarios table directly for the code
    const [usuario] = await sql`
      SELECT id_usuario, nombre_completo, rol 
      FROM usuarios 
      WHERE codigo = ${codigo} AND activo = true
      LIMIT 1
    `;
    
    if (!usuario) {
      return c.json({ error: "Código inválido o expirado" }, 401);
    }

    // Only allow tecnico role for mobile app
    if (usuario.rol !== 'tecnico') {
      return c.json({ error: "Esta cuenta no tiene acceso a la app móvil" }, 403);
    }

    const token = await signJwt({ sub: usuario.id_usuario.toString(), nombre: usuario.nombre_completo, rol: usuario.rol });

    return c.json({
      token,
      usuario: { id: usuario.id_usuario, nombre: usuario.nombre_completo, rol: usuario.rol },
    });
  }
);

export default app;
