import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { env } from "@/config/env";

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
    origin:
      env.corsOrigins.length > 0
        ? (origin) => {
            if (!origin) return env.corsOrigins[0];
            return env.corsOrigins.includes(origin) ? origin : null;
          }
        : "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/health", (c) =>
  c.json({ status: "ok", service: "api-app", ts: new Date().toISOString() })
);

app.get("/cloudinary-config", (c) => {
  const hasCloudinary = Boolean(
    env.CLOUDINARY_CLOUD_NAME?.trim() &&
      env.CLOUDINARY_API_KEY?.trim() &&
      env.CLOUDINARY_API_SECRET?.trim()
  );

  if (!hasCloudinary) {
    return c.json({ error: "Cloudinary no configurado" }, 500);
  }

  return c.json({
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    uploadPreset: env.CLOUDINARY_PRESET_IMAGENES,
  });
});

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
  if (err instanceof HTTPException) {
    return c.json({ error: err.message || "Solicitud inválida" }, err.status);
  }

  console.error(err);
  return c.json({ error: "Error interno del servidor" }, 500);
});

export default app;
