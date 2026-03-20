import { Redis } from "ioredis";

const url =
  process.env.NODE_ENV === "production"
    ? process.env.REDIS_URL!
    : (process.env.REDIS_PUBLIC_URL ?? process.env.REDIS_URL!);

export const redis = new Redis(url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on("error", (err) => {
  console.error("[Redis] error:", err.message);
});
