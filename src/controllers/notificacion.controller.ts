import { Hono } from "hono";
import { authMiddleware } from "@/middleware/auth";
import type { JwtPayload } from "@/lib/jwt";
import {
  obtenerNotificacionesTecnico,
  marcarNotificacionLeida,
} from "@/services/notificacion.service";

const app = new Hono<{
  Variables: {
    tecnico: JwtPayload;
  };
}>();

app.use("*", authMiddleware);

app.get("/", async (c) => {
  const tecnico = c.get("tecnico");
  const notificaciones = await obtenerNotificacionesTecnico(tecnico.sub);
  return c.json(notificaciones);
});

app.patch("/:id/leer", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  await marcarNotificacionLeida(tecnico.sub, id);
  return c.json({ message: "Marcada como leída" });
});

export default app;
