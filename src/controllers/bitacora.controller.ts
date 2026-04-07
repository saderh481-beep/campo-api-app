import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "@/middleware/auth";
import type { JwtPayload } from "@/lib/jwt";
import {
  crearBitacora,
  obtenerBitacorasTecnico,
  obtenerBitacoraPorId,
  actualizarBitacora,
  subirFotoRostroBitacora,
  subirFirmaBitacora,
  subirFotosCampoBitacora,
  cerrarBitacora,
  eliminarBitacora,
} from "@/services/bitacora.service";

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
  sync_id: z.string().optional(),
});

const schemaBitacoraTipoB = z.object({
  tipo: z.literal("actividad"),
  actividad_id: z.string().uuid(),
  fecha_inicio: z.string().datetime(),
  coord_inicio: z.string().optional(),
  sync_id: z.string().optional(),
});

const schemaBitacora = z.discriminatedUnion("tipo", [schemaBitacoraTipoA, schemaBitacoraTipoB]);

app.post("/", zValidator("json", schemaBitacora), async (c) => {
  const tecnico = c.get("tecnico");
  const body = c.req.valid("json");

  const resultado = await crearBitacora(tecnico.sub, {
    tipo: body.tipo,
    beneficiario_id: "beneficiario_id" in body ? body.beneficiario_id : undefined,
    actividad_id: "actividad_id" in body ? body.actividad_id : undefined,
    cadena_productiva_id: "cadena_productiva_id" in body ? body.cadena_productiva_id : undefined,
    fecha_inicio: body.fecha_inicio,
    coord_inicio: body.coord_inicio,
    sync_id: body.sync_id,
  });

  if ("duplicado" in resultado && resultado.duplicado) {
    return c.json({ id: resultado.id }, 200);
  }

  return c.json({ id: resultado.id }, 201);
});

app.get("/", async (c) => {
  const tecnico = c.get("tecnico");
  const limit = parseInt(c.req.query("limit") ?? "50");
  const offset = parseInt(c.req.query("offset") ?? "0");
  const estado = c.req.query("estado") ?? undefined;

  const bitacoras = await obtenerBitacorasTecnico(tecnico.sub, { limit, offset, estado });
  return c.json(bitacoras);
});

app.get("/:id", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  const bitacora = await obtenerBitacoraPorId(tecnico.sub, id);
  if (!bitacora) return c.json({ error: "Bitácora no encontrada" }, 404);

  return c.json(bitacora);
});

const schemaActualizarBitacora = z.object({
  observaciones_coordinador: z.string().optional(),
  actividades_desc: z.string().optional(),
  coord_inicio: z.string().optional(),
  coord_fin: z.string().optional(),
  fecha_inicio: z.string().datetime().optional(),
  fecha_fin: z.string().datetime().optional(),
  recomendaciones: z.string().optional(),
  comentarios_beneficiario: z.string().optional(),
});

app.patch("/:id", zValidator("json", schemaActualizarBitacora), async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();
  const body = c.req.valid("json");

  const resultado = await actualizarBitacora(tecnico.sub, id, body);

  if ("error" in resultado) {
    const status = resultado.error === "Bitácora no encontrada" ? 404 : 400;
    return c.json({ error: resultado.error }, status);
  }

  return c.json(resultado);
});

app.post("/:id/foto-rostro", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  const formData = await c.req.formData();
  const archivo = formData.get("foto");
  if (!(archivo instanceof File)) {
    return c.json({ error: "Foto requerida y debe ser un archivo" }, 400);
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const resultado = await subirFotoRostroBitacora(tecnico.sub, id, buffer);

  if ("error" in resultado) {
    return c.json({ error: resultado.error }, 404);
  }

  return c.json(resultado);
});

app.post("/:id/firma", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  const formData = await c.req.formData();
  const archivo = formData.get("firma");
  if (!(archivo instanceof File)) {
    return c.json({ error: "Firma requerida y debe ser un archivo" }, 400);
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const resultado = await subirFirmaBitacora(tecnico.sub, id, buffer);

  if ("error" in resultado) {
    return c.json({ error: resultado.error }, 404);
  }

  return c.json(resultado);
});

app.post("/:id/fotos-campo", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  const formData = await c.req.formData();
  const archivos = formData.getAll("fotos").filter((f): f is File => f instanceof File);
  if (archivos.length === 0) {
    return c.json({ error: "Se requiere al menos una foto como archivo" }, 400);
  }

  const buffers: Buffer[] = [];
  for (const archivo of archivos) {
    const arrayBuffer = await archivo.arrayBuffer();
    buffers.push(Buffer.from(arrayBuffer));
  }
  const resultado = await subirFotosCampoBitacora(tecnico.sub, id, buffers);

  if ("error" in resultado) {
    const status = resultado.error === "Bitácora no encontrada" ? 404 : 400;
    return c.json({ error: resultado.error }, status);
  }

  return c.json(resultado);
});

const schemaCerrarBitacora = z.object({
  fecha_fin: z.string().datetime(),
  coord_fin: z.string().optional(),
});

app.post("/:id/cerrar", zValidator("json", schemaCerrarBitacora), async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();
  const body = c.req.valid("json");

  const resultado = await cerrarBitacora(tecnico.sub, id, body);

  if ("error" in resultado) {
    const status = resultado.error === "Bitácora no encontrada" ? 404 : 400;
    return c.json({ error: resultado.error }, status);
  }

  return c.json(resultado);
});

app.delete("/:id", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  const resultado = await eliminarBitacora(tecnico.sub, id);

  if ("error" in resultado) {
    const status = resultado.error === "Bitácora no encontrada" ? 404 : 400;
    return c.json({ error: resultado.error }, status);
  }

  return c.json(resultado);
});

export default app;
