import { verifyJwt, type JwtPayload } from "@/lib/jwt";
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

  c.set("tecnico", payload);
  await next();
});
