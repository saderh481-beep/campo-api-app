import { Redis } from "ioredis";
import { env, requireEnv } from "@/config/env";

let redisClient: Redis | null = null;
let redisDisabledReason: string | null = null;

function getRedisUrl() {
  if (env.NODE_ENV === "production") {
    return requireEnv("REDIS_URL");
  }

  return env.REDIS_PUBLIC_URL?.trim() || requireEnv("REDIS_URL");
}

function normalizeRedisUrl(url: string) {
  const trimmed = url.trim();
  const duplicateSchemeIndex = trimmed.indexOf("redis://", "redis://".length);
  const candidate = duplicateSchemeIndex >= 0 ? trimmed.slice(0, duplicateSchemeIndex) : trimmed;
  const parsed = new URL(candidate);

  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error("protocolo Redis inválido");
  }

  if (!parsed.hostname) {
    throw new Error("host Redis inválido");
  }

  return candidate;
}

function getRedisClient() {
  if (redisDisabledReason) return null;
  if (!redisClient) {
    try {
      const redisUrl = normalizeRedisUrl(getRedisUrl());
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 200, 2_000),
      });

      redisClient.on("error", (err) => {
        console.error("[Redis] error:", err.message);
      });
    } catch (error) {
      redisDisabledReason = error instanceof Error ? error.message : "configuración inválida";
      console.error(`[Redis] deshabilitado: ${redisDisabledReason}`);
      return null;
    }
  }

  return redisClient;
}

export const redis = {
  async del(key: string) {
    const client = getRedisClient();
    if (!client) return 0;
    return client.del(key);
  },
  async expire(key: string, seconds: number) {
    const client = getRedisClient();
    if (!client) return 0;
    return client.expire(key, seconds);
  },
  async get(key: string) {
    const client = getRedisClient();
    if (!client) return null;
    return client.get(key);
  },
  async incr(key: string) {
    const client = getRedisClient();
    if (!client) return 0;
    return client.incr(key);
  },
  async setex(key: string, seconds: number, value: string) {
    const client = getRedisClient();
    if (!client) return "OK";
    return client.setex(key, seconds, value);
  },
};
