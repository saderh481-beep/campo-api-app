import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { rateLimiter } from "hono-rate-limiter";
import { env } from "@/config/env";
import { sql } from "@/config/db";
import { redis } from "@/config/db";
import { handleError } from "@/lib/errors";

// Módulos
import authRouter              from "@/modules/auth/router";
import beneficiariosRouter     from "@/modules/beneficiarios/router";
import bitacorasRouter         from "@/modules/bitacoras/router";
import bitacorasUploadsRouter  from "@/modules/bitacoras/uploads.router";
import documentosRouter        from "@/modules/documentos/router";
import syncRouter              from "@/modules/sync/router";
import catalogosRouter         from "@/modules/catalogos/router";
import actividadesRouter       from "@/modules/actividades-tecnico/router";

const app = new Hono();

// ── Middleware global ──────────────────────────────────────────────────────────
app.use("*", logger());
app.use("*", secureHeaders());

app.use("*", cors({
  origin:       "*",
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge:       86400,
}));

app.use("*", rateLimiter({
  windowMs:     60_000,
  limit:        200,
  keyGenerator: (c) => c.req.header("x-forwarded-for") ?? "anon",
}));

app.use("/auth/*", rateLimiter({
  windowMs:     15 * 60_000,
  limit:        20,
  keyGenerator: (c) => c.req.header("x-forwarded-for") ?? "anon",
}));

// ── Health check ───────────────────────────────────────────────────────────────
app.get("/health", async (c) => {
  try {
    await sql`SELECT 1`;
    await redis.ping();
    return c.json({ ok: true, service: "api-app", ts: new Date().toISOString() });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 503);
  }
});

// ── Rutas ──────────────────────────────────────────────────────────────────────
app.route("/auth",              authRouter);
app.route("/mis-beneficiarios", beneficiariosRouter);
app.route("/mis-actividades",   actividadesRouter);
app.route("/bitacoras",         bitacorasRouter);
app.route("/bitacoras",         bitacorasUploadsRouter); // fotos, firma, pdf
app.route("/documentos",        documentosRouter);       // docs de beneficiarios
app.route("/sync",              syncRouter);
app.route("/",                  catalogosRouter);        // cadenas y actividades

// ── Errores ────────────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: "Ruta no encontrada" }, 404));
app.onError(handleError);

// ── Servidor ───────────────────────────────────────────────────────────────────
console.log(`📱 api-app → http://localhost:${env.PORT}`);
export default { port: env.PORT, fetch: app.fetch };