import { Redis } from "ioredis";
import { env } from "@/config/env";

const url =
  env.NODE_ENV === "production" ? env.REDIS_URL : (env.REDIS_PUBLIC_URL ?? env.REDIS_URL);

export const redis = new Redis(url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 200, 2_000),
});

redis.on("error", (err) => {
  console.error("[Redis] error:", err.message);
});
