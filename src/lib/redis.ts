import { Redis } from "ioredis";
import { env, getRedisUrl } from "@/config/env";

let redisClient: Redis | null = null;
let redisDisabledReason: string | null = null;

function createRedisUrl() {
  return getRedisUrl();
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
      const redisUrl = normalizeRedisUrl(createRedisUrl());
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
  async publish(channel: string, message: string) {
    const client = getRedisClient();
    if (!client) return 0;
    return client.publish(channel, message);
  },
  async subscribe(channel: string, callback: (message: string) => void) {
    const client = getRedisClient();
    if (!client) return;
    const subscriber = client.duplicate();
    await subscriber.subscribe(channel);
    subscriber.on("message", (ch, msg) => {
      if (ch === channel) {
        callback(msg);
      }
    });
  },
};
