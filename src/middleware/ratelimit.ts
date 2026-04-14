import { redis } from "@/lib/redis";
import { env } from "@/config/env";
import type { Context, Next } from "hono";

const DEFAULT_MAX = 100;
const DEFAULT_WINDOW = 60;

export async function rateLimit(c: Context, next: Next, max?: number, windowSecs?: number) {
  const ip = getClientIp(c);
  const route = new URL(c.req.url).pathname;
  const key = `rl:${ip}:${route}`;
  const limit = max ?? env.RATE_LIMIT_MAX ?? DEFAULT_MAX;
  const windowSec = windowSecs ?? env.RATE_LIMIT_WINDOW_SECS ?? DEFAULT_WINDOW;

  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);

    c.res.headers.set("X-RateLimit-Limit", String(limit));
    c.res.headers.set("X-RateLimit-Remaining", String(Math.max(0, limit - count)));

    if (count > limit) {
      c.res.headers.set("Retry-After", String(windowSec));
      return c.json({ 
        error: "Demasiadas solicitudes", 
        retryAfter: windowSec 
      }, 429);
    }
  } catch (error) {
    console.error("[rateLimit] Redis no disponible, permitiendo request:", error);
  }

  return next();
}

export function rateLimitMiddleware(max?: number, windowSecs?: number) {
  return (c: Context, next: Next) => rateLimit(c, next, max, windowSecs);
}

export function globalRateLimit() {
  return async (c: Context, next: Next) => {
    const publicRoutes = ["/health", "/version", "/events", "/auth/tecnico"];
    const path = new URL(c.req.url).pathname;
    
    if (publicRoutes.some(route => path.startsWith(route))) {
      return next();
    }
    
    return rateLimit(c, next);
  };
}

function getClientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  const realIp = c.req.header("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  
  return "unknown";
}
