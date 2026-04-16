import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { env } from "@/config/env";
import { globalRateLimit } from "@/middleware/ratelimit";
import { errorHandler } from "@/lib/error-handler";

import {
  authController,
  beneficiarioController,
  bitacoraController,
  notificacionController,
  syncController,
} from "@/controllers";

const app = new Hono();

app.use("*", errorHandler);
app.use("*", logger());
app.use("*", secureHeaders());
app.use("*", globalRateLimit());
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

app.get("/health", async (c) => {
  const health: {
    status: string;
    timestamp: string;
    services: {
      database: { status: string; latencyMs?: number; error?: string };
      redis: { status: string; latencyMs?: number; error?: string };
    };
  } = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      database: { status: "unknown" },
      redis: { status: "unknown" },
    },
  };

  const startDb = Date.now();
  try {
    const { sql } = await import("@/db");
    await sql`SELECT 1`;
    health.services.database = {
      status: "ok",
      latencyMs: Date.now() - startDb,
    };
  } catch (error) {
    health.services.database = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
    health.status = "degraded";
  }

  const startRedis = Date.now();
  try {
    const { redis } = await import("@/lib/redis");
    await redis.get("healthcheck");
    health.services.redis = {
      status: "ok",
      latencyMs: Date.now() - startRedis,
    };
  } catch (error) {
    health.services.redis = {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
    health.status = "degraded";
  }

  const httpStatus = health.status === "ok" ? 200 : 503;
  return c.json(health, httpStatus);
});

app.get("/version", (c) =>
  c.json({ version: "1.0.0", deployedAt: new Date().toISOString() })
);

app.get("/cloudinary-config", (c) => {
  const hasCloudinary = Boolean(
    env.CLOUDINARY_CLOUD_NAME?.trim() &&
      env.CLOUDINARY_API_KEY?.trim() &&
      env.CLOUDINARY_API_SECRET?.trim()
  );

  if (!hasCloudinary) {
    return c.json({ error: "Cloudinary no configurado", configured: false }, 500);
  }

  return c.json({
    configured: true,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    uploadPreset: env.CLOUDINARY_PRESET_IMAGENES,
    docsPreset: env.CLOUDINARY_PRESET_DOCS,
  });
});

app.get("/events/:tecnicoId", async (c) => {
  const tecnicoId = c.req.param("tecnicoId");

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no");

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "connected", tecnicoId, ts: new Date().toISOString() });

      const channels = ["beneficiarios:updated", "bitacora:updated"];

      const handleMessage = (channel: string, msg: string) => {
        try {
          const parsed = JSON.parse(msg);
          if (parsed.tecnicoId === tecnicoId || tecnicoId === "*") {
            send({ channel, ...parsed });
          }
        } catch {}
      };

      const subscriptions: Promise<void>[] = [];

      const { redis } = require("./lib/redis");
      for (const channel of channels) {
        subscriptions.push(
          redis.subscribe(channel, (message: string) => handleMessage(channel, message)).catch(
            (err: Error) => console.error(`[SSE] Subscribe error for ${channel}:`, err.message)
          )
        );
      }

      let closed = false;
      const close = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {}
        }
      };

      c.req.raw.signal.addEventListener("abort", close);

      const keepAlive = setInterval(() => {
        if (closed) {
          clearInterval(keepAlive);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(keepAlive);
        }
      }, 30000);

      return () => {
        clearInterval(keepAlive);
      };
    },
  });

  return c.body(stream);
});

// Rutas de datos (beneficiarios, actividades, cadenas, localidades)
app.route("/api/v1", beneficiarioController);

// Rutas de bitácoras
app.route("/api/v1/bitacoras", bitacoraController);

// Rutas de sincronización
app.route("/api/v1", syncController);

// Rutas de notificaciones
app.route("/api/v1/notificaciones", notificacionController);

// Rutas legacy (sin versionar - mantener temporalmente)
app.route("/auth", authController);
app.route("/", beneficiarioController);
app.route("/bitacoras", bitacoraController);
app.route("/", syncController);
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
