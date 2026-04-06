import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
    PORT: z.coerce.number().int().positive().default(3002),
    DATABASE_URL: z.string().min(1, "DATABASE_URL es requerido"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
    REDIS_URL: z.string().min(1, "REDIS_URL es requerido"),
    REDIS_PUBLIC_URL: z.string().min(1).optional(),
    CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME es requerido"),
    CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY es requerido"),
    CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET es requerido"),
    CLOUDINARY_PRESET_IMAGENES: z.string().min(1, "CLOUDINARY_PRESET_IMAGENES es requerido"),
    CLOUDINARY_PRESET_DOCS: z.string().min(1, "CLOUDINARY_PRESET_DOCS es requerido"),
    CORS_ORIGIN: z.string().optional(),
    WEB_ORIGIN: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production" && !value.REDIS_PUBLIC_URL && !value.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["REDIS_PUBLIC_URL"],
        message: "REDIS_PUBLIC_URL o REDIS_URL es requerido fuera de producción",
      });
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

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
