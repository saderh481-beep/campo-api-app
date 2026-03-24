import { Hono } from "hono";
import { sql } from "@/db";
import { authMiddleware } from "@/middleware/auth";
import type { JwtPayload } from "@/lib/jwt";

const app = new Hono<{
  Variables: {
    tecnico: JwtPayload
  }
}>();
app.use("*", authMiddleware);

app.get("/", async (c) => {
  const tecnico = c.get("tecnico");
  const notificaciones = await sql`
    SELECT id, destino_id, destino_tipo, tipo, titulo, cuerpo, leido, enviado_push, enviado_email, created_at
    FROM notificaciones
    WHERE destino_id = ${tecnico.sub} AND leido = false
    ORDER BY created_at DESC
  `;
  return c.json(notificaciones);
});

app.patch("/:id/leer", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();
  await sql`
    UPDATE notificaciones SET leido = true
    WHERE id = ${id} AND destino_id = ${tecnico.sub}
  `;
  return c.json({ message: "Marcada como leída" });
});

export default app;
