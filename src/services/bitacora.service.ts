// @ts-nocheck
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
import { publishUpdate, CHANNELS } from "./pubsub.service";

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
    actividades_desc?: string;
    recomendaciones?: string;
    comentarios_beneficiario?: string;
    coordinacion_interinst?: boolean;
    instancia_coordinada?: string;
    proposito_coordinacion?: string;
    observaciones_coordinador?: string;
    calificacion?: number;
    reporte?: string;
    datos_extendidos?: Record<string, unknown>;
  }
) {
  const syncId = data.sync_id ? (() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const offlineRegex = /^offline-\d+-[a-z0-9]+$/i;
    if (uuidRegex.test(data.sync_id) || offlineRegex.test(data.sync_id)) {
      return data.sync_id;
    }
    return null;
  })() : null;

  if (syncId) {
    const [existente] = await sql.unsafe(`
      SELECT id, tipo, estado, fecha_inicio, fecha_fin, sync_id
      FROM bitacoras
      WHERE sync_id = $1::text
    `, [syncId]);
    if (existente) {
      return { duplicado: true, ...existente };
    }
  }

  const [nueva] = await sql<BitacoraResumen[]>`
    INSERT INTO bitacoras (
      tecnico_id, tipo, estado, fecha_inicio, coord_inicio, sync_id,
      beneficiario_id, cadena_productiva_id, actividad_id,
      actividades_desc, recomendaciones, comentarios_beneficiario,
      coordinacion_interinst, instancia_coordinada, proposito_coordinacion,
      observaciones_coordinador, calificacion, reporte, datos_extendidos
    ) VALUES (
      ${tecnicoId}, ${data.tipo}, 'borrador', ${data.fecha_inicio},
      ${data.coord_inicio ?? null},
      ${data.sync_id ?? null},
      ${data.beneficiario_id ?? null},
      ${data.tipo === "beneficiario" ? data.cadena_productiva_id ?? null : null},
      ${data.actividad_id ?? null},
      ${data.actividades_desc ?? ''},
${data.recomendaciones ?? ''},
${data.comentarios_beneficiario ?? ''},
      ${data.coordinacion_interinst ?? false},
${data.instancia_coordinada ?? ''},
${data.proposito_coordinacion ?? ''},
      ${data.observaciones_coordinador ?? null},
      ${data.calificacion ?? null},
      ${data.reporte ?? null},
      ${data.datos_extendidos ? JSON.stringify(data.datos_extendidos) : null}
    )
    RETURNING id, tipo, estado, fecha_inicio, sync_id
  `;

  publishUpdate(CHANNELS.BITACORA_UPDATED, tecnicoId, {
    action: "created",
    bitacoraId: nueva.id,
    tipo: nueva.tipo,
    beneficiario_id: data.beneficiario_id,
    actividad_id: data.actividad_id,
  });

  return nueva;
}

export async function obtenerBitacorasTecnico(
  tecnicoId: string,
  options: { limit?: number; offset?: number; estado?: string } = {}
) {
  const { limit = 50, offset = 0, estado } = options;

  console.log("[obtenerBitacorasTecnico] tecnicoId:", tecnicoId, "estado:", estado, "limit:", limit, "offset:", offset);

  let bitacoras;
  
  const baseQuery = estado
    ? `SELECT b.*, 
        ben.nombre as beneficiario_nombre, 
        act.nombre as actividad_nombre
      FROM bitacoras b
      LEFT JOIN beneficiarios ben ON b.beneficiario_id = ben.id
      LEFT JOIN actividades act ON b.actividad_id = act.id
      WHERE b.tecnico_id = $1 AND b.estado = $2
      ORDER BY b.fecha_inicio DESC
      LIMIT $3 OFFSET $4`
    : `SELECT b.*, 
        ben.nombre as beneficiario_nombre, 
        act.nombre as actividad_nombre
      FROM bitacoras b
      LEFT JOIN beneficiarios ben ON b.beneficiario_id = ben.id
      LEFT JOIN actividades act ON b.actividad_id = act.id
      WHERE b.tecnico_id = $1
      ORDER BY b.fecha_inicio DESC
      LIMIT $2 OFFSET $3`;

  if (estado) {
    bitacoras = await sql.unsafe(baseQuery, [tecnicoId, estado, limit, offset]);
  } else {
    bitacoras = await sql.unsafe(baseQuery, [tecnicoId, limit, offset]);
  }

  console.log("[obtenerBitacorasTecnico] Query ejecutada, bitacoras.length:", bitacoras?.length ?? 0);

  return bitacoras || [];
}

export async function obtenerBitacoraPorId(tecnicoId: string, bitacoraId: string) {
  const [bitacora] = await sql.unsafe(`
    SELECT b.*, 
      ben.nombre as beneficiario_nombre, 
      act.nombre as actividad_nombre
    FROM bitacoras b
    LEFT JOIN beneficiarios ben ON b.beneficiario_id = ben.id
    LEFT JOIN actividades act ON b.actividad_id = act.id
    WHERE b.id = $1 AND b.tecnico_id = $2
  `, [bitacoraId, tecnicoId]);
  
  return bitacora || null;
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
    estado?: string;
    coordinacion_interinst?: boolean;
    instancia_coordinada?: string;
    proposito_coordinacion?: string;
    calificacion?: number;
    reporte?: string;
    datos_extendidos?: Record<string, unknown>;
  }
) {
  const [bitacora] = await sql<Bitacora[]>`
    SELECT id, estado FROM bitacoras WHERE id = ${bitacoraId} AND tecnico_id = ${tecnicoId}
  `;
  if (!bitacora) return { error: "Bitácora no encontrada" };
  if (bitacora.estado !== "borrador") {
    return { error: "Solo se pueden editar borradores" };
  }

  const updates: string[] = [];
  const params: any[] = [bitacoraId];
  let paramIndex = 2;

  if (data.observaciones_coordinador !== undefined) {
    updates.push(`observaciones_coordinador = $${paramIndex++}`);
    params.push(data.observaciones_coordinador);
  }
  if (data.actividades_desc !== undefined) {
    updates.push(`actividades_desc = $${paramIndex++}`);
    params.push(data.actividades_desc);
  }
  if (data.coord_inicio !== undefined) {
    updates.push(`coord_inicio = $${paramIndex++}`);
    params.push(data.coord_inicio);
  }
  if (data.coord_fin !== undefined) {
    updates.push(`coord_fin = $${paramIndex++}`);
    params.push(data.coord_fin);
  }
  if (data.fecha_inicio !== undefined) {
    updates.push(`fecha_inicio = $${paramIndex++}`);
    params.push(data.fecha_inicio);
  }
  if (data.fecha_fin !== undefined) {
    updates.push(`fecha_fin = $${paramIndex++}`);
    params.push(data.fecha_fin);
  }
  if (data.recomendaciones !== undefined) {
    updates.push(`recomendaciones = $${paramIndex++}`);
    params.push(data.recomendaciones);
  }
  if (data.comentarios_beneficiario !== undefined) {
    updates.push(`comentarios_beneficiario = $${paramIndex++}`);
    params.push(data.comentarios_beneficiario);
  }
  if (data.estado !== undefined) {
    updates.push(`estado = $${paramIndex++}`);
    params.push(data.estado);
  }
  if (data.coordinacion_interinst !== undefined) {
    updates.push(`coordinacion_interinst = $${paramIndex++}`);
    params.push(data.coordinacion_interinst);
  }
  if (data.instancia_coordinada !== undefined) {
    updates.push(`instancia_coordinada = $${paramIndex++}`);
    params.push(data.instancia_coordinada);
  }
  if (data.proposito_coordinacion !== undefined) {
    updates.push(`proposito_coordinacion = $${paramIndex++}`);
    params.push(data.proposito_coordinacion);
  }
  if (data.calificacion !== undefined) {
    updates.push(`calificacion = $${paramIndex++}`);
    params.push(data.calificacion);
  }
  if (data.reporte !== undefined) {
    updates.push(`reporte = $${paramIndex++}`);
    params.push(data.reporte);
  }
  if (data.datos_extendidos !== undefined) {
    updates.push(`datos_extendidos = $${paramIndex++}`);
    params.push(JSON.stringify(data.datos_extendidos));
  }

  if (updates.length === 0) {
    return { error: "No hay campos para actualizar" };
  }

  updates.push(`updated_at = NOW()`);

  params.push(tecnicoId);

  const query = `
    UPDATE bitacoras SET ${updates.join(", ")}
    WHERE id = $1 AND tecnico_id = $${paramIndex}
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
      comentarios_beneficiario,
      coordinacion_interinst,
      instancia_coordinada,
      proposito_coordinacion,
      calificacion,
      reporte,
      datos_extendidos
  `;

  const [actualizada] = await sql.unsafe(query, params);
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
  const fotosArrayStr = `{${todasLasUrls.map(url => `"${url}"`).join(',')}}`;
  await sql`
    UPDATE bitacoras SET fotos_campo = ${fotosArrayStr}::text[], updated_at = NOW() WHERE id = ${bitacoraId}
  `;
  return { fotos_campo: todasLasUrls };
}

export async function guardarFotoRostroUrl(
  tecnicoId: string,
  bitacoraId: string,
  url: string
) {
  const [bitacora] = await sql`
    SELECT id FROM bitacoras WHERE id = ${bitacoraId} AND tecnico_id = ${tecnicoId}
  `;
  if (!bitacora) return { error: "Bitácora no encontrada" };

  await sql`UPDATE bitacoras SET foto_rostro_url = ${url}, updated_at = NOW() WHERE id = ${bitacoraId}`;
  return { foto_rostro_url: url };
}

export async function guardarFirmaUrl(
  tecnicoId: string,
  bitacoraId: string,
  url: string
) {
  const [bitacora] = await sql`
    SELECT id FROM bitacoras WHERE id = ${bitacoraId} AND tecnico_id = ${tecnicoId}
  `;
  if (!bitacora) return { error: "Bitácora no encontrada" };

  await sql`UPDATE bitacoras SET firma_url = ${url}, updated_at = NOW() WHERE id = ${bitacoraId}`;
  return { firma_url: url };
}

export async function guardarFotosCampoUrls(
  tecnicoId: string,
  bitacoraId: string,
  urls: string[]
) {
  const [bitacora] = await sql`
    SELECT id, fotos_campo FROM bitacoras WHERE id = ${bitacoraId} AND tecnico_id = ${tecnicoId}
  `;
  if (!bitacora) return { error: "Bitácora no encontrada" };

  const existentes: string[] = Array.isArray(bitacora.fotos_campo) ? bitacora.fotos_campo : [];
  const disponibles = 10 - existentes.length;
  if (disponibles <= 0) {
    return { error: "Máximo 10 fotos por bitácora" };
  }

  const nuevasUrls = urls.slice(0, disponibles);
  const todasLasUrls = [...existentes, ...nuevasUrls];
  const fotosArrayStr = `{${todasLasUrls.map(url => `"${url.replace(/"/g, '\\"')}"`).join(',')}}`;
  await sql`
    UPDATE bitacoras SET fotos_campo = ${fotosArrayStr}::text[], updated_at = NOW() WHERE id = ${bitacoraId}
  `;
  return { fotos_campo: todasLasUrls };
}

export async function cerrarBitacora(
  tecnicoId: string,
  bitacoraId: string,
  data: { 
    fecha_fin: string; 
    coord_fin?: string;
    actividades_desc?: string;
    recomendaciones?: string;
    comentarios_beneficiario?: string;
    coordinacion_interinst?: boolean;
    instancia_coordinada?: string;
    proposito_coordinacion?: string;
    calificacion?: number;
    reporte?: string;
    datos_extendidos?: Record<string, unknown>;
  }
) {
  try {
    const [bitacora] = await sql<Bitacora[]>`
      SELECT * FROM bitacoras WHERE id = ${bitacoraId} AND tecnico_id = ${tecnicoId}
    `;
    if (!bitacora) return { error: "Bitácora no encontrada" };
    if (bitacora.estado !== "borrador") {
      return { error: "La bitácora ya está cerrada" };
    }

    const actividadDesc = data.actividades_desc || '';
    const recomendacionesTxt = data.recomendaciones || '';
    const comentariosTxt = data.comentarios_beneficiario || '';
    const coordInter = data.coordinacion_interinst !== undefined ? data.coordinacion_interinst : (bitacora.coordinacion_interinst ?? false);
    const instanciaTxt = data.instancia_coordinada || '';
    const propositoTxt = data.proposito_coordinacion || '';
    const reporteTxt = data.reporte || '';
    const datosExt = data.datos_extendidos ? JSON.stringify(data.datos_extendidos) : null;
    const calif = data.calificacion !== undefined ? data.calificacion : null;

    const [cerrada] = await sql<Bitacora[]>`
      UPDATE bitacoras SET
        estado = 'cerrada',
        fecha_fin = ${data.fecha_fin},
        coord_fin = ${data.coord_fin ?? null},
        actividades_desc = CASE WHEN ${actividadDesc} = '' THEN actividades_desc ELSE ${actividadDesc} END,
        recomendaciones = CASE WHEN ${recomendacionesTxt} = '' THEN recomendaciones ELSE ${recomendacionesTxt} END,
        comentarios_beneficiario = CASE WHEN ${comentariosTxt} = '' THEN comentarios_beneficiario ELSE ${comentariosTxt} END,
        coordinacion_interinst = ${coordInter},
        instancia_coordinada = CASE WHEN ${instanciaTxt} = '' THEN instancia_coordinada ELSE ${instanciaTxt} END,
        proposito_coordinacion = CASE WHEN ${propositoTxt} = '' THEN proposito_coordinacion ELSE ${propositoTxt} END,
        calificacion = ${calif},
        reporte = CASE WHEN ${reporteTxt} = '' THEN reporte ELSE ${reporteTxt} END,
        datos_extendidos = ${datosExt},
        updated_at = NOW()
      WHERE id = ${bitacoraId}
      RETURNING *
    `;

    // Generar PDF
    try {
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
    } catch (pdfErr) {
      console.error("Error al generar/subir PDF:", pdfErr);
    } finally {
      // Always return success even if PDF fails
    }

    // Notificación al técnico
    try {
      await sql`
        INSERT INTO notificaciones (destino_id, destino_tipo, tipo, titulo, cuerpo)
        VALUES (${tecnicoId}, 'tecnico', 'bitacora_cerrada', 'Bitácora cerrada', ${'La bitácora ' + bitacoraId.slice(0, 8) + ' ha sido cerrada exitosamente'})
      `;
    } catch (notifErr) {
      console.error("Error al crear notificación:", notifErr);
    }

    publishUpdate(CHANNELS.BITACORA_UPDATED, tecnicoId, {
      action: "closed",
      bitacoraId,
      estado: "cerrada",
      fecha_fin: data.fecha_fin,
    });

    return { 
      id: bitacoraId, 
      estado: "cerrada",
      fecha_fin: data.fecha_fin,
      pdf_url: cerrada.pdf_url_actual 
    };
  } catch (err) {
    console.error("Error en cerrarBitacora:", err);
    return { error: "Error al cerrar bitácora" };
  }
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

  publishUpdate(CHANNELS.BITACORA_UPDATED, tecnicoId, {
    action: "deleted",
    bitacoraId,
  });

  return { message: "Bitácora eliminada" };
}
