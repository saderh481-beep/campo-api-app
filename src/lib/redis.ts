import { Redis } from "ioredis";

let url = process.env.REDIS_URL ?? process.env.REDIS_PUBLIC_URL ?? "redis://localhost:6379";

// Fix Railway duplicated URL
if (url.includes('railway.internal') && url.includes(url.split('@')[1])) {
  const parts = url.split('@');
  url = `redis://${parts[0]}@${parts[1].split('redis://')[1] || parts[1]}`;
}

export const redis = new Redis(url, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  lazyConnect: true,
  db: 0, // Fix 'NaN' DB select
});

redis.on("error", (err) => {
  console.error("[Redis] error:", err.message);
});
