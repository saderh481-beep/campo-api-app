import { redis } from "@/lib/redis";
import type { Context, Next } from "hono";

export async function rateLimit(c: Context, next: Next, max = 20, windowSecs = 60) {
  const safeMax = Math.floor(Number(max) || 20);
  const safeWindow = Math.floor(Number(windowSecs) || 60);
  
  const ip = c.req.header("x-forwarded-for") ?? "unknown";
  const route = new URL(c.req.url).pathname;
  const key = `rl:${ip}:${route}`;

  let count: number;
  try {
    count = Number(await redis.incr(key));
    if (isNaN(count)) {
      console.warn('[RateLimit] incr returned NaN, resetting key');
      await redis.del(key);
      count = 1;
    }
  } catch (err) {
    console.error('[RateLimit] incr failed:', err);
    count = 1;
  }
  
  if (count === 1) {
    try {
      await redis.expire(key, safeWindow);
    } catch (err) {
      console.warn('[RateLimit] expire failed:', err);
    }
  }

  if (count > safeMax) {
    return c.json({ error: "Demasiadas solicitudes, intenta más tarde" }, 429);
  }
  return next();
}

export function rateLimitMiddleware(max = 20, windowSecs = 60) {
  return (c: Context, next: Next) => rateLimit(c, next, max, windowSecs);
}
