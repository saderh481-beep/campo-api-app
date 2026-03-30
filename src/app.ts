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

import { sql } from "@/db";
import { redis } from "@/lib/redis";

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

// Health check con verificación de conexiones
app.get("/health", async (c) => {
  const checks = {
    status: "ok",
    service: "api-app",
    ts: new Date().toISOString(),
    checks: {
      database: "ok",
      redis: "ok",
    },
  };

  // Verificar conexión a la base de datos
  try {
    await sql`SELECT 1`;
  } catch (err) {
    checks.status = "degraded";
    checks.checks.database = "error";
    console.error("[Health] Error de conexión a la base de datos:", err);
  }

  // Verificar conexión a Redis
  try {
    await redis.ping();
  } catch (err) {
    checks.status = "degraded";
    checks.checks.redis = "error";
    console.error("[Health] Error de conexión a Redis:", err);
  }

  const statusCode = checks.status === "ok" ? 200 : 503;
  return c.json(checks, statusCode);
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
  console.error(err);
  return c.json({ error: "Error interno del servidor" }, 500);
});

export default app;
