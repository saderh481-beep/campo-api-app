import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import authRoutes from "@/routes/auth";
import datosRoutes from "@/routes/datos";
import bitacorasRoutes from "@/routes/bitacoras";
import syncRoutes from "@/routes/sync";
import notificacionesRoutes from "@/routes/notificaciones";

const app = new Hono();

app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/health", (c) =>
  c.json({ status: "ok", service: "api-app", ts: new Date().toISOString() })
);

app.route("/auth", authRoutes);
app.route("/", datosRoutes);
app.route("/bitacoras", bitacorasRoutes);
app.route("/", syncRoutes);
app.route("/notificaciones", notificacionesRoutes);

app.notFound((c) => c.json({ error: "Ruta no encontrada" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Error interno del servidor" }, 500);
});

export default app;
