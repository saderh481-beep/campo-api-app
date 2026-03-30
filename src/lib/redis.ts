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

const rawRedisUrl = process.env.REDIS_URL || 'redis://default:SdekIELQIOJNBXLIUXHgDfHQhfqSwgqU@mainline.proxy.rlwy.net:26908';
const cleanRedisUrl = sanitizeRedisUrl(rawRedisUrl);
console.log('[Redis] Using URL:', cleanRedisUrl);

export const redis = new Redis(cleanRedisUrl, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  lazyConnect: true,
  db: 0
});

redis.on("error", (err) => {
  console.error("[Redis] error:", err.message);
});

redis.on("connect", () => {
  console.log("[Redis] connected successfully");
});