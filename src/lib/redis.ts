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
      console.warn("[Redis] Detected duplicated URL, using first part only");
      return url.substring(0, secondStart).replace(/\/+$/, "");
    }
  }
  
  return url;
}

let redisUrl: string;

if (process.env.NODE_ENV === "production") {
  redisUrl = process.env.REDIS_URL!;
} else {
  redisUrl = process.env.REDIS_PUBLIC_URL ?? process.env.REDIS_URL!;
}

// Sanitize the URL to handle potential duplication
redisUrl = sanitizeRedisUrl(redisUrl);

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on("error", (err) => {
  console.error("[Redis] error:", err.message);
});

redis.on("connect", () => {
  console.log("[Redis] connected successfully");
});