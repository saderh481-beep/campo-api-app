import { createMiddleware } from "hono/factory";
import { verifyToken } from "@/lib/jwt";
import { UnauthorizedError } from "@/lib/errors";

export const requireAuth = createMiddleware(async (c, next) => {
  const header = c.req.header("Authorization");
  const token  = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new UnauthorizedError("Token requerido");

  try {
    const payload = await verifyToken(token);
    c.set("jwtPayload", payload);
    await next();
  } catch {
    throw new UnauthorizedError("Token inválido o expirado");
  }
});
