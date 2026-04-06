import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import {
  authController,
  beneficiarioController,
  bitacoraController,
  notificacionController,
  syncController,
} from "@/controllers";

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

// Rutas de autenticación
app.route("/auth", authController);

// Rutas de datos (beneficiarios, actividades, cadenas, localidades)
app.route("/", beneficiarioController);

// Rutas de bitácoras
app.route("/bitacoras", bitacoraController);

// Rutas de sincronización
app.route("/", syncController);

// Rutas de notificaciones
app.route("/notificaciones", notificacionController);

app.notFound((c) => c.json({ error: "Ruta no encontrada" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Error interno del servidor" }, 500);
});

export default app;
