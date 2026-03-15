import { Hono } from "hono";
import { requireAuth } from "@/middleware/auth";
import { sql } from "@/config/db";
import { redis } from "@/config/db";

const router = new Hono();
router.use("*", requireAuth);

const CACHE_TTL = 60 * 60 * 24; // 24 horas

// GET /cadenas-productivas — catálogo completo con caché
router.get("/cadenas-productivas", async (c) => {
  const cacheKey = "cache:cadenas";
  const cached   = await redis.get(cacheKey);

  if (cached) {
    c.header("X-Cache", "HIT");
    return c.json(JSON.parse(cached));
  }

  const cadenas = await sql`
    SELECT id, nombre FROM cadenas_productivas
    WHERE activo = TRUE ORDER BY nombre ASC
  `;

  const payload = { data: cadenas };
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(payload));
  c.header("X-Cache", "MISS");
  return c.json(payload);
});

// GET /actividades — catálogo completo con caché
router.get("/actividades", async (c) => {
  const cacheKey = "cache:actividades";
  const cached   = await redis.get(cacheKey);

  if (cached) {
    c.header("X-Cache", "HIT");
    return c.json(JSON.parse(cached));
  }

  const actividades = await sql`
    SELECT id, nombre, descripcion FROM actividades
    WHERE activo = TRUE ORDER BY nombre ASC
  `;

  const payload = { data: actividades };
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(payload));
  c.header("X-Cache", "MISS");
  return c.json(payload);
});

export default router;
