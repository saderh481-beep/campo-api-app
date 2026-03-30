import app from "./app";

// Validar variables de entorno requeridas
const requiredEnvVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "REDIS_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`[api-app] Error: Variables de entorno faltantes: ${missingVars.join(", ")}`);
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3002);

console.log(`[api-app] Escuchando en http://0.0.0.0:${port}`);
console.log(`[api-app] Entorno: ${process.env.NODE_ENV ?? "development"}`);

export default {
  port,
  fetch: app.fetch,
};
