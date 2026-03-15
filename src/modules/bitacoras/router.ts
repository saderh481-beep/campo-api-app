import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "@/middleware/auth";
import * as service from "./service";
import {
  crearBitacoraSchema,
  actualizarBitacoraSchema,
  cerrarBitacoraSchema,
  listarBitacorasSchema,
} from "./schema";

const router = new Hono();
router.use("*", requireAuth);

// GET /bitacoras
router.get("/", zValidator("query", listarBitacorasSchema), async (c) => {
  const tecnicoId = c.get("jwtPayload").sub;
  return c.json(await service.listar(tecnicoId, c.req.valid("query")));
});

// GET /bitacoras/:id
router.get("/:id", async (c) => {
  return c.json({ bitacora: await service.obtener(c.req.param("id"), c.get("jwtPayload").sub) });
});

// POST /bitacoras — nueva bitácora Tipo A o B
router.post("/", zValidator("json", crearBitacoraSchema), async (c) => {
  const bitacora = await service.crear(c.get("jwtPayload").sub, c.req.valid("json") as any);
  return c.json({ bitacora }, 201);
});

// PATCH /bitacoras/:id — actualizar notas (solo borradores)
router.patch("/:id", zValidator("json", actualizarBitacoraSchema), async (c) => {
  const { notas } = c.req.valid("json");
  const bitacora  = await service.actualizar(c.req.param("id"), c.get("jwtPayload").sub, notas);
  return c.json({ bitacora });
});

// POST /bitacoras/:id/cerrar — GPS fin + cierre + encola PDF
router.post("/:id/cerrar", zValidator("json", cerrarBitacoraSchema), async (c) => {
  const { gpsFin } = c.req.valid("json");
  const bitacora   = await service.cerrar(c.req.param("id"), c.get("jwtPayload").sub, gpsFin);
  return c.json({ bitacora });
});

export default router;
