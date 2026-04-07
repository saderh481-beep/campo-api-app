import { sql } from "@/db";
import { createHash } from "node:crypto";
import {
  subirFotoRostro,
  subirFirma,
  subirFotoCampo,
  subirPdfBitacora,
} from "@/lib/cloudinary";
import { generarPdfBitacora } from "@/lib/pdf";
import type { Bitacora, BitacoraResumen } from "@/models";

export async function crearBitacora(
  tecnicoId: string,
  data: {
    tipo: string;
    beneficiario_id?: string;
    actividad_id?: string;
    cadena_productiva_id?: string;
    fecha_inicio: string;
    coord_inicio?: string;
    sync_id?: string;
  }
) {
  // Verificar si ya existe por sync_id
  if (data.sync_id) {
    const [existente] = await sql<BitacoraResumen[]>`
      SELECT id, tipo, estado, fecha_inicio, fecha_fin, sync_id
      FROM bitacoras
      WHERE sync_id = ${data.sync_id}
    `;
    if (existente) {
      return { duplicado: true, ...existente };
    }
  }

  const [nueva] = await sql<BitacoraResumen[]>`
    INSERT INTO bitacoras (
      tecnico_id, tipo, estado, fecha_inicio, coord_inicio, sync_id,
      beneficiario_id, cadena_productiva_id, actividad_id
    ) VALUES (
      ${tecnicoId}, ${data.tipo}, 'borrador', ${data.fecha_inicio},
      ${data.coord_inicio ?? null},
      ${data.sync_id ?? null},
      ${data.beneficiario_id ?? null},
      ${data.tipo === "beneficiario" ? data.cadena_productiva_id ?? null : null},
      ${data.actividad_id ?? null}
    )
    RETURNING id, tipo, estado, fecha_inicio, sync_id
  `;
  return nueva;
}

export async function obtenerBitacorasTecnico(
  tecnicoId: string,
  options: { limit?: number; offset?: number; estado?: string } = {}
) {
  const { limit = 50, offset = 0, estado } = options;
  const ahora = new Date();

  const bitacoras = await sql<Bitacora[]>`
    SELECT *
    FROM bitacoras
    WHERE tecnico_id = ${tecnicoId}
      AND (${estado ?? null} IS NULL OR estado = ${estado ?? null})
      AND EXTRACT(MONTH FROM fecha_inicio) = ${ahora.getMonth() + 1}
      AND EXTRACT(YEAR FROM fecha_inicio) = ${ahora.getFullYear()}
    ORDER BY fecha_inicio DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return bitacoras;
}

export async function obtenerBitacoraPorId(tecnicoId: string, bitacoraId: string) {
  const [bitacora] = await sql<Bitacora[]>`
    SELECT * FROM bitacoras WHERE id = ${bitacoraId} AND tecnico_id = ${tecnicoId}
  `;
  return bitacora ?? null;
}

export async function actualizarBitacora(
  tecnicoId: string,
  bitacoraId: string,
  data: {
    observaciones_coordinador?: string;
    actividades_desc?: string;
    coord_inicio?: string;
    coord_fin?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    recomendaciones?: string;
    comentarios_beneficiario?: string;
  }
) {
  const [bitacora] = await sql<Bitacora[]>`
    SELECT id, estado FROM bitacoras WHERE id = ${bitacoraId} AND tecnico_id = ${tecnicoId}
  `;
  if (!bitacora) return { error: "Bitácora no encontrada" };
  if (bitacora.estado !== "borrador") {
    return { error: "Solo se pueden editar borradores" };
  }

  const [actualizada] = await sql<Bitacora[]>`
    UPDATE bitacoras SET
      observaciones_coordinador = COALESCE(${data.observaciones_coordinador ?? null}, observaciones_coordinador),
      actividades_desc          = COALESCE(${data.actividades_desc ?? null}, actividades_desc),
      coord_inicio              = COALESCE(${data.coord_inicio ?? null}, coord_inicio),
      coord_fin                 = COALESCE(${data.coord_fin ?? null}, coord_fin),
      fecha_inicio              = COALESCE(${data.fecha_inicio ?? null}, fecha_inicio),
      fecha_fin                 = COALESCE(${data.fecha_fin ?? null}, fecha_fin),
      recomendaciones           = COALESCE(${data.recomendaciones ?? null}, recomendaciones),
      comentarios_beneficiario  = COALESCE(${data.comentarios_beneficiario ?? null}, comentarios_beneficiario),
      updated_at                = NOW()
    WHERE id = ${bitacoraId}
    RETURNING
      id,
      tipo,
      estado,
      fecha_inicio,
      fecha_fin,
      coord_inicio,
      coord_fin,
      observaciones_coordinador,
      actividades_desc,
      recomendaciones,
      comentarios_beneficiario
  `;
  return actualizada;
}

export async function subirFotoRostroBitacora(
  tecnicoId: string,
  bitacoraId: string,
  archivo: Buffer
) {
  const [bitacora] = await sql`
    SELECT id FROM bitacoras WHERE id = ${bitacoraId} AND tecnico_id = ${tecnicoId}
  `;
  if (!bitacora) return { error: "Bitácora no encontrada" };

  const { secure_url } = await subirFotoRostro(archivo, bitacoraId);
  await sql`UPDATE bitacoras SET foto_rostro_url = ${secure_url}, updated_at = NOW() WHERE id = ${bitacoraId}`;
  return { foto_rostro_url: secure_url };
}

export async function subirFirmaBitacora(
  tecnicoId: string,
  bitacoraId: string,
  archivo: Buffer
) {
  const [bitacora] = await sql`
    SELECT id FROM bitacoras WHERE id = ${bitacoraId} AND tecnico_id = ${tecnicoId}
  `;
  if (!bitacora) return { error: "Bitácora no encontrada" };

  const { secure_url } = await subirFirma(archivo, bitacoraId);
  await sql`UPDATE bitacoras SET firma_url = ${secure_url}, updated_at = NOW() WHERE id = ${bitacoraId}`;
  return { firma_url: secure_url };
}

export async function subirFotosCampoBitacora(
  tecnicoId: string,
  bitacoraId: string,
  archivos: Buffer[]
) {
  const [bitacora] = await sql`
    SELECT id, fotos_campo FROM bitacoras WHERE id = ${bitacoraId} AND tecnico_id = ${tecnicoId}
  `;
  if (!bitacora) return { error: "Bitácora no encontrada" };

  const existentes: string[] = Array.isArray(bitacora.fotos_campo) ? bitacora.fotos_campo : [];
  if (existentes.length >= 10) {
    return { error: "Máximo 10 fotos por bitácora" };
  }

  const permitidas = archivos.slice(0, 10 - existentes.length);
  const mes = new Date().getMonth() + 1;
  const nuevasUrls: string[] = [];

  for (let i = 0; i < permitidas.length; i++) {
    const { secure_url } = await subirFotoCampo(permitidas[i], tecnicoId, mes, i);
    nuevasUrls.push(secure_url);
  }

  const todasLasUrls = [...existentes, ...nuevasUrls];
  await sql`
    UPDATE bitacoras SET fotos_campo = ${JSON.stringify(todasLasUrls)}, updated_at = NOW() WHERE id = ${bitacoraId}
  `;
  return { fotos_campo: todasLasUrls };
}

export async function cerrarBitacora(
  tecnicoId: string,
  bitacoraId: string,
  data: { fecha_fin: string; coord_fin?: string }
) {
  const [bitacora] = await sql<Bitacora[]>`
    SELECT * FROM bitacoras WHERE id = ${bitacoraId} AND tecnico_id = ${tecnicoId}
  `;
  if (!bitacora) return { error: "Bitácora no encontrada" };
  if (bitacora.estado !== "borrador") {
    return { error: "La bitácora ya está cerrada" };
  }

  const [cerrada] = await sql<Bitacora[]>`
    UPDATE bitacoras SET
      estado = 'cerrada',
      fecha_fin = ${data.fecha_fin},
      coord_fin = ${data.coord_fin ?? null},
      updated_at = NOW()
    WHERE id = ${bitacoraId}
    RETURNING *
  `;

  // Generar PDF
  const pdfBytes = await generarPdfBitacora(cerrada);
  const buffer = Buffer.from(pdfBytes);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const mes = new Date(cerrada.fecha_inicio).getMonth() + 1;
  const { secure_url } = await subirPdfBitacora(buffer, tecnicoId, mes, bitacoraId);
  const nuevaVersion = Number(cerrada.pdf_version ?? 0) + 1;

  await sql`
    UPDATE bitacoras
    SET pdf_version = ${nuevaVersion},
        pdf_url_actual = ${secure_url},
        pdf_original_url = COALESCE(pdf_original_url, ${secure_url}),
        updated_at = NOW()
    WHERE id = ${bitacoraId}
  `;

  await sql`
    INSERT INTO pdf_versiones (bitacora_id, version, r2_key, sha256, inmutable, generado_por)
    VALUES (${bitacoraId}, ${nuevaVersion}, ${secure_url}, ${sha256}, false, ${tecnicoId})
  `;

  return { id: bitacoraId, estado: "cerrada", pdf_url: secure_url };
}

export async function eliminarBitacora(tecnicoId: string, bitacoraId: string) {
  const [bitacora] = await sql`
    SELECT id, estado, created_at FROM bitacoras WHERE id = ${bitacoraId} AND tecnico_id = ${tecnicoId}
  `;
  if (!bitacora) return { error: "Bitácora no encontrada" };
  if (bitacora.estado !== "borrador") {
    return { error: "Solo se pueden eliminar borradores" };
  }

  const hoy = new Date().toDateString();
  const creadoHoy = new Date(bitacora.created_at).toDateString() === hoy;
  if (!creadoHoy) {
    return { error: "Solo se pueden eliminar borradores creados hoy" };
  }

  await sql`DELETE FROM bitacoras WHERE id = ${bitacoraId}`;
  return { message: "Bitácora eliminada" };
}
