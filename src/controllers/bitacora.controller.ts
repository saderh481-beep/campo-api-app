import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "@/middleware/auth";
import { validateImageUpload, validateMultipleImages } from "@/middleware/validate-upload";
import type { JwtPayload } from "@/lib/jwt";
import {
  crearBitacora,
  obtenerBitacorasTecnico,
  obtenerBitacoraPorId,
  actualizarBitacora,
  subirFotoRostroBitacora,
  subirFirmaBitacora,
  subirFotosCampoBitacora,
  guardarFotoRostroUrl,
  guardarFirmaUrl,
  guardarFotosCampoUrls,
  cerrarBitacora,
  eliminarBitacora,
} from "@/services/bitacora.service";
import { generateUploadSignature } from "@/lib/cloudinary";

const app = new Hono<{
  Variables: {
    tecnico: JwtPayload;
  };
}>();

app.use("*", authMiddleware);

const schemaBitacoraBase = z.object({
  actividades_desc: z.string().optional(),
  recomendaciones: z.string().optional(),
  comentarios_beneficiario: z.string().optional(),
  coordinacion_interinst: z.boolean().optional(),
  instancia_coordinada: z.string().optional(),
  proposito_coordinacion: z.string().optional(),
  observaciones_coordinador: z.string().optional(),
  calificacion: z.number().int().min(1).max(10).optional(),
  reporte: z.string().optional(),
  datos_extendidos: z.any().optional(),
});

const schemaBitacoraTipoA = schemaBitacoraBase.extend({
  tipo: z.literal("beneficiario"),
  beneficiario_id: z.string().uuid(),
  cadena_productiva_id: z.string().uuid().optional(),
  fecha_inicio: z.string().datetime(),
  coord_inicio: z.string().optional(),
  sync_id: z.string().optional(),
});

const schemaBitacoraTipoB = schemaBitacoraBase.extend({
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
    actividades_desc: body.actividades_desc,
    recomendaciones: body.recomendaciones,
    comentarios_beneficiario: body.comentarios_beneficiario,
    coordinacion_interinst: body.coordinacion_interinst,
    instancia_coordinada: body.instancia_coordinada,
    proposito_coordinacion: body.proposito_coordinacion,
    observaciones_coordinador: body.observaciones_coordinador,
    calificacion: body.calificacion,
    reporte: body.reporte,
    datos_extendidos: body.datos_extendidos,
  });

  if ("duplicado" in resultado && resultado.duplicado) {
    return c.json({ id: resultado.id }, 200);
  }

  return c.json({ id: resultado.id }, 201);
});

import { sql } from "@/db";

app.get("/", async (c) => {
  const tecnico = c.get("tecnico");
  const limit = parseInt(c.req.query("limit") ?? "50");
  const offset = parseInt(c.req.query("offset") ?? "0");
  const estado = c.req.query("estado") ?? undefined;

  const bitacoras = await obtenerBitacorasTecnico(tecnico.sub, { limit, offset, estado });
  return c.json(bitacoras);
});

app.get("/beneficiario/:beneficiarioId", async (c) => {
  const tecnico = c.get("tecnico");
  const { beneficiarioId } = c.req.param();

  const bitacoras = await sql`
    SELECT 
      id, sync_id, tipo, estado, fecha_inicio, fecha_fin,
      coord_inicio, coord_fin,
      actividades_desc, recomendaciones, comentarios_beneficiario,
      coordinacion_interinst, instancia_coordinada, proposito_coordinacion,
      observaciones_coordinador, foto_rostro_url, firma_url, fotos_campo,
      calificacion, reporte, datos_extendidos, created_at, updated_at
    FROM bitacoras
    WHERE tecnico_id = ${tecnico.sub}
      AND beneficiario_id = ${beneficiarioId}
    ORDER BY fecha_inicio DESC
  `;

  return c.json(bitacoras);
});

app.get("/contador", async (c) => {
  const tecnico = c.get("tecnico");
  const ahora = new Date();
  const mes = ahora.getMonth() + 1;
  const anio = ahora.getFullYear();

  const [result] = await sql<{ total: number }[]>`
    SELECT COUNT(*)::int as total
    FROM bitacoras
    WHERE tecnico_id = ${tecnico.sub}
      AND estado = 'borrador'
      AND EXTRACT(MONTH FROM fecha_inicio) = ${mes}
      AND EXTRACT(YEAR FROM fecha_inicio) = ${anio}
  `;

  return c.json({ pendientes: result?.total ?? 0 });
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
  estado: z.string().optional(),
  coordinacion_interinst: z.boolean().optional(),
  instancia_coordinada: z.string().optional(),
  proposito_coordinacion: z.string().optional(),
  calificacion: z.number().int().min(1).max(10).optional(),
  reporte: z.string().optional(),
  datos_extendidos: z.any().optional(),
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

  if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
    return c.json({ 
      error: "Tipo de archivo no permitido", 
      allowedTypes: ["image/jpeg", "image/png", "image/webp"],
      receivedType: archivo.type 
    }, 400);
  }

  if (archivo.size > 10 * 1024 * 1024) {
    return c.json({ 
      error: "Archivo demasiado grande", 
      maxSizeMB: 10,
      receivedSizeMB: (archivo.size / (1024 * 1024)).toFixed(2)
    }, 413);
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

  if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
    return c.json({ 
      error: "Tipo de archivo no permitido", 
      allowedTypes: ["image/jpeg", "image/png", "image/webp"],
      receivedType: archivo.type 
    }, 400);
  }

  if (archivo.size > 5 * 1024 * 1024) {
    return c.json({ 
      error: "Archivo demasiado grande", 
      maxSizeMB: 5,
      receivedSizeMB: (archivo.size / (1024 * 1024)).toFixed(2)
    }, 413);
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
  const archivosArray = formData.getAll("fotos[]").filter((f): f is File => f instanceof File);
  const todosArchivos = [...archivos, ...archivosArray];
  
  if (todosArchivos.length === 0) {
    return c.json({ error: "Se requiere al menos una foto como archivo" }, 400);
  }

  if (todosArchivos.length > 10) {
    return c.json({ error: "Máximo 10 fotos por bitácora" }, 400);
  }

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_SIZE = 10 * 1024 * 1024;
  
  for (const archivo of todosArchivos) {
    if (!ALLOWED_TYPES.includes(archivo.type)) {
      return c.json({ 
        error: "Tipo de archivo no permitido", 
        allowedTypes: ALLOWED_TYPES,
        receivedType: archivo.type 
      }, 400);
    }
    if (archivo.size > MAX_SIZE) {
      return c.json({ 
        error: "Archivo demasiado grande", 
        maxSizeMB: 10,
        receivedSizeMB: (archivo.size / (1024 * 1024)).toFixed(2)
      }, 413);
    }
  }

  const buffers: Buffer[] = [];
  for (const archivo of todosArchivos) {
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

app.post("/:id/foto-rostro/signature", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  const [bitacora] = await sql`SELECT id FROM bitacoras WHERE id = ${id} AND tecnico_id = ${tecnico.sub}`;
  if (!bitacora) {
    return c.json({ error: "Bitácora no encontrada" }, 404);
  }

  const signature = generateUploadSignature({
    folder: `campo/rostros/${id}`,
    publicId: `rostro-${id}`,
    resourceType: "image",
  });

  if (!signature) {
    return c.json({ error: "Cloudinary no configurado" }, 500);
  }

  return c.json(signature);
});

app.post("/:id/foto-rostro/url", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();
  const body = await c.req.json<{ url: string }>();

  if (!body.url || typeof body.url !== "string") {
    return c.json({ error: "URL requerida" }, 400);
  }

  const resultado = await guardarFotoRostroUrl(tecnico.sub, id, body.url);

  if ("error" in resultado) {
    const status = resultado.error === "Bitácora no encontrada" ? 404 : 400;
    return c.json({ error: resultado.error }, status);
  }

  return c.json(resultado);
});

app.post("/:id/firma/signature", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  const [bitacora] = await sql`SELECT id FROM bitacoras WHERE id = ${id} AND tecnico_id = ${tecnico.sub}`;
  if (!bitacora) {
    return c.json({ error: "Bitácora no encontrada" }, 404);
  }

  const signature = generateUploadSignature({
    folder: `campo/firmas/${id}`,
    publicId: `firma-${id}`,
    resourceType: "image",
  });

  if (!signature) {
    return c.json({ error: "Cloudinary no configurado" }, 500);
  }

  return c.json(signature);
});

app.post("/:id/firma/url", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();
  const body = await c.req.json<{ url: string }>();

  if (!body.url || typeof body.url !== "string") {
    return c.json({ error: "URL requerida" }, 400);
  }

  const resultado = await guardarFirmaUrl(tecnico.sub, id, body.url);

  if ("error" in resultado) {
    const status = resultado.error === "Bitácora no encontrada" ? 404 : 400;
    return c.json({ error: resultado.error }, status);
  }

  return c.json(resultado);
});

app.post("/:id/fotos-campo/signature", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();
  const index = parseInt(c.req.query("index") ?? "0");

  const [bitacora] = await sql`SELECT id FROM bitacoras WHERE id = ${id} AND tecnico_id = ${tecnico.sub}`;
  if (!bitacora) {
    return c.json({ error: "Bitácora no encontrada" }, 404);
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `campo/fotos/${tecnico.sub}/${new Date().getMonth() + 1}`;
  const publicId = `foto-${Date.now()}-${index}`;

  const signature = generateUploadSignature({
    folder,
    publicId,
    resourceType: "image",
  });

  if (!signature) {
    return c.json({ error: "Cloudinary no configurado" }, 500);
  }

  return c.json(signature);
});

app.post("/:id/fotos-campo/url", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();
  const body = await c.req.json<{ url: string }>();

  if (!body.url || typeof body.url !== "string") {
    return c.json({ error: "URL requerida" }, 400);
  }

  const resultado = await guardarFotosCampoUrls(tecnico.sub, id, [body.url]);

  if ("error" in resultado) {
    const status = resultado.error === "Bitácora no encontrada" ? 404 : 400;
    return c.json({ error: resultado.error }, status);
  }

  return c.json(resultado);
});

app.post("/:id/fotos-campo/urls", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();
  const body = await c.req.json<{ urls: string[] }>();

  if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
    return c.json({ error: "URLs requeridas" }, 400);
  }

  const resultado = await guardarFotosCampoUrls(tecnico.sub, id, body.urls);

  if ("error" in resultado) {
    const status = resultado.error === "Bitácora no encontrada" ? 404 : 400;
    return c.json({ error: resultado.error }, status);
  }

  return c.json(resultado);
});

app.get("/:id/foto-rostro", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  const [bitacora] = await sql<{ foto_rostro_url: string | null }[]>`
    SELECT foto_rostro_url FROM bitacoras WHERE id = ${id} AND tecnico_id = ${tecnico.sub}
  `;
  if (!bitacora) {
    return c.json({ error: "Bitácora no encontrada" }, 404);
  }

  return c.json({ url: bitacora.foto_rostro_url });
});

app.get("/:id/firma", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  const [bitacora] = await sql<{ firma_url: string | null }[]>`
    SELECT firma_url FROM bitacoras WHERE id = ${id} AND tecnico_id = ${tecnico.sub}
  `;
  if (!bitacora) {
    return c.json({ error: "Bitácora no encontrada" }, 404);
  }

  return c.json({ url: bitacora.firma_url });
});

app.get("/:id/fotos-campo", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  const [bitacora] = await sql<{ fotos_campo: string[] }[]>`
    SELECT fotos_campo FROM bitacoras WHERE id = ${id} AND tecnico_id = ${tecnico.sub}
  `;
  if (!bitacora) {
    return c.json({ error: "Bitácora no encontrada" }, 404);
  }

  return c.json({ urls: bitacora.fotos_campo || [] });
});

app.delete("/:id/fotos-campo/:idx", async (c) => {
  const tecnico = c.get("tecnico");
  const { id, idx } = c.req.param();
  const index = parseInt(idx);

  if (isNaN(index)) {
    return c.json({ error: "Índice inválido" }, 400);
  }

  const [bitacora] = await sql<{ fotos_campo: string[] }[]>`
    SELECT fotos_campo FROM bitacoras WHERE id = ${id} AND tecnico_id = ${tecnico.sub}
  `;
  if (!bitacora) {
    return c.json({ error: "Bitácora no encontrada" }, 404);
  }

  const urls: string[] = bitacora.fotos_campo || [];
  if (index < 0 || index >= urls.length) {
    return c.json({ error: "Índice fuera de rango" }, 400);
  }

  urls.splice(index, 1);

  await sql`UPDATE bitacoras SET fotos_campo = ${JSON.stringify(urls)}::jsonb, updated_at = NOW() WHERE id = ${id}`;

  return c.json({ urls });
});

const schemaCerrarBitacora = z.object({
  fecha_fin: z.string().datetime(),
  coord_fin: z.string().optional(),
  actividades_desc: z.string().optional(),
  recomendaciones: z.string().optional(),
  comentarios_beneficiario: z.string().optional(),
  coordinacion_interinst: z.boolean().optional(),
  instancia_coordinada: z.string().optional(),
  proposito_coordinacion: z.string().optional(),
  calificacion: z.number().int().min(1).max(10).optional(),
  reporte: z.string().optional(),
  datos_extendidos: z.any().optional(),
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
