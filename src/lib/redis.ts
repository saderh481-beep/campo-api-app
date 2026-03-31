// redis.ts
import { Redis } from "ioredis";

// Helper function to fix duplicated Redis URLs
function sanitizeRedisUrl(url: string): string {
  if (!url) return url;
  
  // Check if the URL is duplicated (e.g., "redis://...redis://...")
  const redisProtocolPattern = /redis:\/\//g;
  const matches = url.match(redisProtocolPattern);
  
  if (matches && matches.length > 1) {
    // Find the second occurrence and truncate
    const firstEnd = url.indexOf("redis://");
    const secondStart = url.indexOf("redis://", firstEnd + 1);
    if (secondStart > -1) {
      console.warn("⚠️  [Redis] URL duplicada detectada, usando solo la primera parte");
      return url.substring(0, secondStart).replace(/\/+$/, "");
    }
  }
  
  return url;
}

if (!process.env.REDIS_URL) {
  throw new Error("❌ REDIS_URL no está configurada en Railway");
}

// Sanitize the URL to handle potential duplication
const redisUrl = sanitizeRedisUrl(process.env.REDIS_URL);

// Configuración limpia y estable para Railway
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  connectTimeout: 10000,
  enableOfflineQueue: true,
  db: 0,
});

// Eventos claros
redis.on("connect", () => {
  console.log("✅ Redis: Conectado");
});

redis.on("ready", () => {
  console.log("🚀 Redis: Listo para usar");
});

redis.on("error", (err: Error) => {
  console.error("❌ Redis Error:", err.message);
});

redis.on("reconnecting", () => {
  console.log("🔄 Redis: Reintentando conexión...");
});

// Health check útil
export const redisHealth = async (): Promise<{ status: string; latency?: number; error?: string }> => {
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    return { status: 'healthy', latency };
  } catch (err) {
    console.error("Redis health check falló:", err);
    return { status: 'unhealthy', error: err instanceof Error ? err.message : 'Unknown error' };
  }
};

// Graceful shutdown
process.on("beforeExit", async () => {
  try {
    await redis.disconnect();
    console.log("Redis desconectado correctamente");
  } catch (err) {
    console.error("Error al desconectar Redis:", err);
  }
});