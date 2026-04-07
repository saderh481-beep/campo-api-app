import { env } from "../src/config/env";
import { sql } from "../src/db";
import { redis } from "../src/lib/redis";
import { v2 as cloudinary } from "cloudinary";

type CheckResult = {
  service: string;
  ok: boolean;
  detail: string;
};

function hasCloudinaryConfig() {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME?.trim() &&
      env.CLOUDINARY_API_KEY?.trim() &&
      env.CLOUDINARY_API_SECRET?.trim()
  );
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    const [row] = await sql<{ now: string; current_database: string }[]>`
      SELECT NOW()::text AS now, current_database() AS current_database
    `;

    return {
      service: "database",
      ok: true,
      detail: `Conectado a ${row.current_database} en ${row.now}`,
    };
  } catch (error) {
    return {
      service: "database",
      ok: false,
      detail: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const key = `check:${Date.now()}`;

  try {
    await redis.setex(key, 30, "ok");
    const value = await redis.get(key);
    await redis.del(key);

    return {
      service: "redis",
      ok: value === "ok",
      detail: value === "ok" ? "SET/GET/DEL funcionando" : "Redis respondió, pero el valor no coincidió",
    };
  } catch (error) {
    return {
      service: "redis",
      ok: false,
      detail: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

async function checkCloudinary(): Promise<CheckResult> {
  if (!hasCloudinaryConfig()) {
    return {
      service: "cloudinary",
      ok: false,
      detail: "Faltan variables CLOUDINARY_*",
    };
  }

  try {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });

    const result = await cloudinary.api.ping();
    return {
      service: "cloudinary",
      ok: result.status === "ok",
      detail: `API ping: ${result.status}`,
    };
  } catch (error) {
    return {
      service: "cloudinary",
      ok: false,
      detail: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

async function main() {
  const results = await Promise.all([checkDatabase(), checkRedis(), checkCloudinary()]);

  for (const result of results) {
    console.log(`${result.ok ? "OK" : "FAIL"} ${result.service}: ${result.detail}`);
  }

  const hasFailure = results.some((result) => !result.ok);
  if (typeof (sql as { end?: (options?: { timeout?: number }) => Promise<void> }).end === "function") {
    await (sql as { end: (options?: { timeout?: number }) => Promise<void> }).end({ timeout: 5 });
  }

  if (hasFailure) {
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error("No se pudieron verificar las conexiones:", error);
  try {
    if (typeof (sql as { end?: (options?: { timeout?: number }) => Promise<void> }).end === "function") {
      await (sql as { end: (options?: { timeout?: number }) => Promise<void> }).end({ timeout: 5 });
    }
  } catch {}
  process.exit(1);
});
