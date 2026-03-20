import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sql } from "@/db";
import { authMiddleware } from "@/middleware/auth";
import {
  subirFotoRostro,
  subirFirma,
  subirFotoCampo,
  subirPdfBitacora,
} from "@/lib/cloudinary";
import { generarPdfBitacora } from "@/lib/pdf";

const app = new Hono();
app.use("*", authMiddleware);

const schemaBitacoraTipoA = z.object({
  tipo: z.literal("beneficiario"),
  beneficiario_id: z.string().uuid(),
  cadena_productiva_id: z.string().uuid(),
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

  if (body.sync_id) {
    const [existente] = await sql`SELECT id FROM bitacoras WHERE sync_id = ${body.sync_id}`;
    if (existente) return c.json({ id: existente.id, duplicado: true });
  }

  const [nueva] = await sql`
    INSERT INTO bitacoras (
      tecnico_id, tipo, estado, fecha_inicio, coord_inicio, sync_id,
      beneficiario_id, cadena_productiva_id, actividad_id
    ) VALUES (
      ${tecnico.sub}, ${body.tipo}, 'borrador', ${body.fecha_inicio},
      ${("coord_inicio" in body ? body.coord_inicio : null) ?? null},
      ${("sync_id" in body ? body.sync_id : null) ?? null},
      ${"beneficiario_id" in body ? body.beneficiario_id : null},
      ${"cadena_productiva_id" in body ? body.cadena_productiva_id : null},
      ${"actividad_id" in body ? body.actividad_id : null}
    )
    RETURNING id, tipo, estado, fecha_inicio, sync_id
  `;
  return c.json(nueva, 201);
});

app.get("/", async (c) => {
  const tecnico = c.get("tecnico");
  const ahora = new Date();
  const bitacoras = await sql`
    SELECT id, tipo, estado, fecha_inicio, fecha_fin, sync_id
    FROM bitacoras
    WHERE tecnico_id = ${tecnico.sub}
      AND EXTRACT(MONTH FROM fecha_inicio) = ${ahora.getMonth() + 1}
      AND EXTRACT(YEAR FROM fecha_inicio) = ${ahora.getFullYear()}
    ORDER BY fecha_inicio DESC
  `;
  return c.json(bitacoras);
});

app.get("/:id", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();
  const [bitacora] = await sql`
    SELECT * FROM bitacoras WHERE id = ${id} AND tecnico_id = ${tecnico.sub}
  `;
  if (!bitacora) return c.json({ error: "Bitácora no encontrada" }, 404);
  return c.json(bitacora);
});

app.patch(
  "/:id",
  zValidator(
    "json",
    z.object({
      observaciones: z.string().optional(),
      actividades_realizadas: z.string().optional(),
    })
  ),
  async (c) => {
    const tecnico = c.get("tecnico");
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const [bitacora] = await sql`
      SELECT id, estado FROM bitacoras WHERE id = ${id} AND tecnico_id = ${tecnico.sub}
    `;
    if (!bitacora) return c.json({ error: "Bitácora no encontrada" }, 404);
    if (bitacora.estado !== "borrador") {
      return c.json({ error: "Solo se pueden editar borradores" }, 400);
    }

    const [actualizada] = await sql`
      UPDATE bitacoras SET
        observaciones          = COALESCE(${body.observaciones ?? null}, observaciones),
        actividades_realizadas = COALESCE(${body.actividades_realizadas ?? null}, actividades_realizadas),
        actualizado_en         = NOW()
      WHERE id = ${id}
      RETURNING id, tipo, estado, observaciones, actividades_realizadas
    `;
    return c.json(actualizada);
  }
);

app.post("/:id/foto-rostro", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  const [bitacora] = await sql`
    SELECT id FROM bitacoras WHERE id = ${id} AND tecnico_id = ${tecnico.sub}
  `;
  if (!bitacora) return c.json({ error: "Bitácora no encontrada" }, 404);

  const formData = await c.req.formData();
  const archivo = formData.get("foto");
  if (!(archivo instanceof File)) return c.json({ error: "Foto requerida y debe ser un archivo" }, 400);

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const { secure_url } = await subirFotoRostro(buffer, id);

  await sql`UPDATE bitacoras SET foto_rostro_url = ${secure_url}, actualizado_en = NOW() WHERE id = ${id}`;
  return c.json({ foto_rostro_url: secure_url });
});

app.post("/:id/firma", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  const [bitacora] = await sql`
    SELECT id FROM bitacoras WHERE id = ${id} AND tecnico_id = ${tecnico.sub}
  `;
  if (!bitacora) return c.json({ error: "Bitácora no encontrada" }, 404);

  const formData = await c.req.formData();
  const archivo = formData.get("firma");
  if (!(archivo instanceof File)) return c.json({ error: "Firma requerida y debe ser un archivo" }, 400);

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const { secure_url } = await subirFirma(buffer, id);

  await sql`UPDATE bitacoras SET firma_url = ${secure_url}, actualizado_en = NOW() WHERE id = ${id}`;
  return c.json({ firma_url: secure_url });
});

app.post("/:id/fotos-campo", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  const [bitacora] = await sql`
    SELECT id, tecnico_id, fotos_campo FROM bitacoras WHERE id = ${id} AND tecnico_id = ${tecnico.sub}
  `;
  if (!bitacora) return c.json({ error: "Bitácora no encontrada" }, 404);

  const existentes: string[] = Array.isArray(bitacora.fotos_campo) ? bitacora.fotos_campo : [];
  if (existentes.length >= 10) {
    return c.json({ error: "Máximo 10 fotos por bitácora" }, 400);
  }

  const formData = await c.req.formData();
  const archivos = formData.getAll("fotos").filter((f): f is File => f instanceof File);
  if (archivos.length === 0) return c.json({ error: "Se requiere al menos una foto como archivo" }, 400);
  const permitidas = archivos.slice(0, 10 - existentes.length);

  const mes = new Date().getMonth() + 1;
  const nuevasUrls: string[] = [];

  for (let i = 0; i < permitidas.length; i++) {
    const buffer = Buffer.from(await permitidas[i].arrayBuffer());
    const { secure_url } = await subirFotoCampo(buffer, tecnico.sub, mes, i);
    nuevasUrls.push(secure_url);
  }

  const todasLasUrls = [...existentes, ...nuevasUrls];
  await sql`
    UPDATE bitacoras SET fotos_campo = ${JSON.stringify(todasLasUrls)}, actualizado_en = NOW() WHERE id = ${id}
  `;
  return c.json({ fotos_campo: todasLasUrls });
});

app.post(
  "/:id/cerrar",
  zValidator(
    "json",
    z.object({ fecha_fin: z.string().datetime(), coord_fin: z.string().optional() })
  ),
  async (c) => {
    const tecnico = c.get("tecnico");
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const [bitacora] = await sql`
      SELECT * FROM bitacoras WHERE id = ${id} AND tecnico_id = ${tecnico.sub}
    `;
    if (!bitacora) return c.json({ error: "Bitácora no encontrada" }, 404);
    if (bitacora.estado !== "borrador") {
      return c.json({ error: "La bitácora ya está cerrada" }, 400);
    }

    const [cerrada] = await sql`
      UPDATE bitacoras SET
        estado     = 'cerrada',
        fecha_fin  = ${body.fecha_fin},
        coord_fin  = ${body.coord_fin ?? null},
        actualizado_en = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    const pdfBytes = await generarPdfBitacora(cerrada);
    const buffer = Buffer.from(pdfBytes);
    const mes = new Date(cerrada.fecha_inicio).getMonth() + 1;
    const { secure_url } = await subirPdfBitacora(buffer, tecnico.sub, mes, id);

    await sql`
      INSERT INTO pdf_versiones (bitacora_id, url, generado_en)
      VALUES (${id}, ${secure_url}, NOW())
    `;

    return c.json({ id, estado: "cerrada", pdf_url: secure_url });
  }
);

app.delete("/:id", async (c) => {
  const tecnico = c.get("tecnico");
  const { id } = c.req.param();

  const [bitacora] = await sql`
    SELECT id, estado, creado_en FROM bitacoras WHERE id = ${id} AND tecnico_id = ${tecnico.sub}
  `;
  if (!bitacora) return c.json({ error: "Bitácora no encontrada" }, 404);
  if (bitacora.estado !== "borrador") {
    return c.json({ error: "Solo se pueden eliminar borradores" }, 400);
  }

  const hoy = new Date().toDateString();
  const creadoHoy = new Date(bitacora.creado_en).toDateString() === hoy;
  if (!creadoHoy) {
    return c.json({ error: "Solo se pueden eliminar borradores creados hoy" }, 400);
  }

  await sql`DELETE FROM bitacoras WHERE id = ${id}`;
  return c.json({ message: "Bitácora eliminada" });
});

export default app;
