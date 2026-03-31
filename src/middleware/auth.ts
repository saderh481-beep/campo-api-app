import { verifyJwt, type JwtPayload } from "@/lib/jwt";
import { sql } from "@/db";
import { redis } from "@/lib/redis";
import { createMiddleware } from "hono/factory";

export type Env = {
  Variables: {
    tecnico: JwtPayload
  }
};

export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return c.json({ error: "No autenticado" }, 401);

  const payload = await verifyJwt(token);
  if (!payload) return c.json({ error: "Token inválido o expirado" }, 401);

  const sessionRaw = await redis.get(`session:${token}`);
  if (!sessionRaw) {
    return c.json({ error: "Token inválido o expirado" }, 401);
  }

  try {
    c.set("tecnico", JSON.parse(sessionRaw) as JwtPayload);
  } catch {
    c.set("tecnico", payload);
  }

  const tecnico = c.get("tecnico");
  const [tecnicoActual] = await sql`
    SELECT activo
    FROM usuarios
    WHERE id = ${tecnico.sub}
    LIMIT 1
  `;

  if (!tecnicoActual || tecnicoActual.activo !== true) {
    return c.json({ error: "Token inválido o expirado" }, 401);
  }

  await next();
});
