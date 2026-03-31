import app from "./app";
import { redisHealth } from './lib/redis';

// Validar variables de entorno requeridas
const requiredEnvVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "REDIS_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`[api-app] Error: Variables de entorno faltantes: ${missingVars.join(", ")}`);
  process.exit(1);
}

// 🛡️ Redis-specific validation (non-crashing)
if (process.env.REDIS_URL) {
  if (process.env.REDIS_URL.length > 200) {
    console.warn('🚨 [Startup] REDIS_URL muy larga - posible duplicación detectada');
  }
  if (process.env.REDIS_URL.match(/redis:\/\/.{80,}redis:\/\//)) {
    console.warn('🚨 [Startup] Duplicación en REDIS_URL detectada - sanitizeRedis limpiará');
  }
} else {
  console.error('🚨 FATAL: REDIS_URL requerida!');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3002);

console.log(`[api-app] Escuchando en http://0.0.0.0:${port}`);
console.log(`[api-app] Entorno: ${process.env.NODE_ENV ?? "development"}`);

// 🚀 PRE-STARTUP Redis health check
console.log('[Startup] 🔍 Testing Redis connection...');
try {
  const health = await redisHealth();
  if (health.status !== 'healthy') {
    console.error('🚨 FATAL: Redis unhealthy at startup:', health);
    process.exit(1);
  }
  console.log('[Startup] ✅ Redis healthy');
} catch (err) {
  console.error('🚨 FATAL: Redis health check failed:', err);
  process.exit(1);
}

// Health check con Redis específico
app.get('/health/redis', async (c) => {
  const health = await redisHealth();
  return c.json({ 
    redis: health, 
    service: 'api-app',
    ts: new Date().toISOString()
  });
});

export default {
  port,
  fetch: app.fetch,
};
