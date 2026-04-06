import { Redis } from "ioredis";
import { env, requireEnv } from "@/config/env";

let redisClient: Redis | null = null;

function getRedisUrl() {
  if (env.NODE_ENV === "production") {
    return requireEnv("REDIS_URL");
  }

  return env.REDIS_PUBLIC_URL?.trim() || requireEnv("REDIS_URL");
}

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 200, 2_000),
    });

    redisClient.on("error", (err) => {
      console.error("[Redis] error:", err.message);
    });
  }

  return redisClient;
}

export const redis = {
  del: (key: string) => getRedisClient().del(key),
  expire: (key: string, seconds: number) => getRedisClient().expire(key, seconds),
  get: (key: string) => getRedisClient().get(key),
  incr: (key: string) => getRedisClient().incr(key),
  setex: (key: string, seconds: number, value: string) => getRedisClient().setex(key, seconds, value),
};
