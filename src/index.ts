import app from "./app";

const port = Number(process.env.PORT ?? 3002);

console.log(`[api-app] Escuchando en http://0.0.0.0:${port}`);

export default {
  port,
  fetch: app.fetch,
};
