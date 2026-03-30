import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "@/middleware/auth";
import type { JwtPayload } from "@/lib/jwt";
import { sincronizarOperaciones, obtenerDeltaSync } from "@/services/sync.service";

const app = new Hono<{
  Variables: {
    tecnico: JwtPayload;
  };
}>();

app.use("*", authMiddleware);

const schemaBitacoraTipoA = z.object({
  tipo: z.literal("beneficiario"),
  beneficiario_id: z.string().uuid(),
  cadena_productiva_id: z.string().uuid().optional(),
  fecha_inicio: z.string().datetime(),
  coord_inicio: z.string().optional(),
  sync_id: z.string(),
});

const schemaBitacoraTipoB = z.object({
  tipo: z.literal("actividad"),
  actividad_id: z.string().uuid(),
  fecha_inicio: z.string().datetime(),
  coord_inicio: z.string().optional(),
  sync_id: z.string(),
});

const schemaOperacion = z.object({
  operacion: z.enum(["crear_bitacora", "cerrar_bitacora", "editar_bitacora"]),
  timestamp: z.string().datetime(),
  payload: z.union([schemaBitacoraTipoA, schemaBitacoraTipoB]),
});

app.post(
  "/sync",
  zValidator("json", z.object({ operaciones: z.array(schemaOperacion) })),
  async (c) => {
    const tecnico = c.get("tecnico");
    const { operaciones } = c.req.valid("json");

    const resultado = await sincronizarOperaciones(tecnico.sub, operaciones);
    return c.json(resultado);
  }
);

app.get("/sync/delta", async (c) => {
  const tecnico = c.get("tecnico");
  const ultimoSync = c.req.query("ultimo_sync");

  const resultado = await obtenerDeltaSync(tecnico.sub, ultimoSync);

  if ("error" in resultado) {
    return c.json({ error: resultado.error }, 400);
  }

  return c.json(resultado);
});

export default app;
