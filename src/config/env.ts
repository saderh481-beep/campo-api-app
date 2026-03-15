import { z } from "zod";

const schema = z.object({
  DATABASE_URL:         z.string().min(1),
  REDIS_URL:            z.string().min(1),
  JWT_SECRET:           z.string().min(32),
  R2_ACCOUNT_ID:        z.string().optional(),
  R2_ACCESS_KEY_ID:     z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME:       z.string().default("campo-docs"),
  PORT:                 z.coerce.number().default(3002),
  NODE_ENV:             z.enum(["development", "production", "test"]).default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variables de entorno inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
