import app from "./app";
import { env } from "@/config/env";

const { port } = { port: env.PORT };

console.log(`[api-app] Escuchando en http://0.0.0.0:${port}`);

export default {
  port,
  fetch: app.fetch,
};
