import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { rateLimitMiddleware } from "@/middleware/ratelimit";
import { loginTecnico, logoutTecnico } from "@/services/auth.service";
import type { JwtPayload } from "@/lib/jwt";

const app = new Hono<{
  Variables: {
    tecnico: JwtPayload;
  };
}>();

const schemaLogin = z.object({
  codigo: z.string().regex(/^\d{5}$/),
});

app.post(
  "/tecnico",
  rateLimitMiddleware(10, 60),
  zValidator("json", schemaLogin),
  async (c) => {
    const { codigo } = c.req.valid("json");
    const ip = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip");
    const userAgent = c.req.header("user-agent");

    const resultado = await loginTecnico(codigo, ip, userAgent);

    if (!resultado.success) {
      return c.json({ error: resultado.error }, 401);
    }

    return c.json({
      token: resultado.token,
      tecnico: resultado.tecnico,
    });
  }
);

app.post("/logout", async (c) => {
  const tecnico = c.get("tecnico");
  const authHeader = c.req.header("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token) {
    await logoutTecnico(token, tecnico.sub);
  }

  return c.json({ message: "Sesión cerrada" });
});

export default app;
