import { Redis } from "ioredis";

const url = process.env.REDIS_URL ?? process.env.REDIS_PUBLIC_URL ?? "redis://localhost:6379";

export const redis = new Redis(url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false, // Disable para Railway
  lazyConnect: true,
});

redis.on("error", (err) => {
  console.error("[Redis] error:", err.message);
});
