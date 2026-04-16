import { z } from "zod";

function sanitizeEnvValue(value: string | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
    PORT: z.coerce.number().int().positive().default(3002),
    DATABASE_URL: z.string().optional(),
    JWT_SECRET: z.string().optional(),
    REDIS_URL: z.string().optional(),
    REDIS_PUBLIC_URL: z.string().optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    CLOUDINARY_PRESET_IMAGENES: z.string().optional(),
    CLOUDINARY_PRESET_DOCS: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
    WEB_ORIGIN: z.string().optional(),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_WINDOW_SECS: z.coerce.number().int().positive().default(60),
    MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(10),
    CAMPO_FILES_API_URL: z.string().optional(),
    API_KEY_APP: z.string().optional(),
    FILES_API_URL: z.string().optional(),
    FILES_API_KEY_APP: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === "production" && !data.JWT_SECRET) {
        return false;
      }
      return true;
    },
    { message: "JWT_SECRET es obligatorio en producción" }
  );

const normalizedEnv = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [key, sanitizeEnvValue(value)])
);

const parsedEnv = envSchema.safeParse(normalizedEnv);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`[api-app] Configuración inválida de entorno: ${details}`);
}

export const env = {
  ...parsedEnv.data,
  corsOrigins: (parsedEnv.data.CORS_ORIGIN ?? parsedEnv.data.WEB_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
} as const;

export function requireEnv(name: keyof typeof env, options?: { minLength?: number }) {
  const rawValue = env[name];
  const value = typeof rawValue === "string" ? rawValue.trim() : undefined;

  if (!value) {
    throw new Error(`[api-app] ${name} no configurado`);
  }

  if (name === "JWT_SECRET" && options?.minLength && value.length < options.minLength) {
    if (env.NODE_ENV === "production") {
      throw new Error(`[api-app] ${name} debe tener al menos ${options.minLength} caracteres en producción`);
    }
    console.warn(`[api-app] ADVERTENCIA: ${name} es corto (${value.length} chars). En producción use al menos ${options.minLength} caracteres.`);
  }

  return value;
}
