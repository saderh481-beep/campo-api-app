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
  c.text("OK", 200)
);

app.get("/version", (c) =>
  c.json({ version: "1.0.0", deployedAt: new Date().toISOString() })
);

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

app.get("/test-upload", async (c) => {
  const hasCloudinary = Boolean(
    env.CLOUDINARY_CLOUD_NAME?.trim() &&
      env.CLOUDINARY_API_KEY?.trim() &&
      env.CLOUDINARY_API_SECRET?.trim() &&
      env.CLOUDINARY_PRESET_IMAGENES?.trim()
  );

  return c.json({
    cloudinaryConfigured: hasCloudinary,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    preset: env.CLOUDINARY_PRESET_IMAGENES,
    envCheck: {
      CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME ? "set" : "missing",
      CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY ? "set" : "missing",
      CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET ? "set" : "missing",
      CLOUDINARY_PRESET_IMAGENES: env.CLOUDINARY_PRESET_IMAGENES ? "set" : "missing",
    },
  });
});

app.post("/test-upload-probe", async (c) => {
  const { requireEnv } = await import("@/config/env");
  
  const result = {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    presetImagenes: env.CLOUDINARY_PRESET_IMAGENES,
    presetDocs: env.CLOUDINARY_PRESET_DOCS,
  };

  return c.json(result);
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
