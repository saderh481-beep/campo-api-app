import postgres from "postgres";
import { Redis } from "ioredis";
import { env } from "./env";

export const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  transform: postgres.camel,
});

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  reconnectOnError: (err) => err.message.includes("READONLY"),
});

redis.on("error", (err) => console.error("[Redis]", err.message));
