// @ts-nocheck
import { sql } from "@/db";
import type { BitacoraResumen, Beneficiario } from "@/models";
import { uploadFirmaFromBase64, uploadFotoRostroFromBase64, uploadFotosCampoFromBase64 } from "@/lib/files-api";

function validarUUID(valor: unknown): boolean {
  if (!valor || typeof valor !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(valor);
}

function validarSyncId(valor: unknown): string | null {
  if (!valor || typeof valor !== 'string') return null;
  if (valor.length === 0 || valor.length > 200) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const offlineRegex = /^offline-\d+-[a-z0-9]+$/i;
  if (uuidRegex.test(valor) || offlineRegex.test(valor)) {
    return valor;
  }
  return null;
}

async function processImageFromDataUri(dataUri: string, type: 'firma' | 'rostro', bitacoraId: string): Promise<string | null> {
  if (!dataUri || !dataUri.startsWith("data:")) {
    return dataUri;
  }
  
  try {
    if (type === 'firma') {
      const result = await uploadFirmaFromBase64(bitacoraId, dataUri);
      return result.success ? result.url ?? null : null;
    } else {
      const result = await uploadFotoRostroFromBase64(bitacoraId, dataUri);
      return result.success ? result.url ?? null : null;
    }
  } catch (err) {
    console.error("[sync.service] Error procesando imagen:", err);
    return null;
  }
}

async function processFotosCampoFromDataUri(base64Array: string[], bitacoraId: string, tecnicoId: string): Promise<string[] | null> {
  if (!base64Array || base64Array.length === 0) {
    return null;
  }
  
  try {
    const result = await uploadFotosCampoFromBase64(bitacoraId, tecnicoId, base64Array);
    if (result.success && result.fotos) {
      return result.fotos.map(f => f.url);
    }
    return null;
  } catch (err) {
    console.error("[sync.service] Error procesando fotos campo:", err);
    return null;
  }
}

export async function sincronizarOperaciones(
  tecnicoId: string,
  operaciones: Array<{
    operacion: string;
    timestamp: string;
    payload: Record<string, unknown>;
  }>
) {
  const ordenadas = [...operaciones].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const resultados: {
    id?: string;
    sync_id?: string;
    bitacora_id?: string;
    remote_id?: string;
    entidad?: string;
    operacion: string;
    exito: boolean;
    estado?: string;
    updated_at?: string;
    error?: string;
  }[] = [];

  for (const op of ordenadas) {
    try {
      if (op.operacion === "crear_beneficiario") {
        const p = op.payload;

        const syncId = validarSyncId(p.sync_id);
        if (!syncId) throw new Error("sync_id requerido");
        
        const [existente] = await sql.unsafe(`
          SELECT id FROM beneficiarios WHERE sync_id = $1 AND tecnico_id = $2
        `, [syncId, tecnicoId]);
        if (existente) {
          resultados.push({
            sync_id: String(p.sync_id),
            id: existente.id,
            remote_id: existente.id,
            entidad: "beneficiario",
            operacion: op.operacion,
            exito: true,
            estado: "sincronizado",
          });
          continue;
        }

        const [nuevo] = await sql<{ id: string; updated_at: string }[]>`
          INSERT INTO beneficiarios (
            nombre, municipio, localidad, telefono_principal, tecnico_id, sync_id,
            telefono_secundario, direccion, cp, coord_parcela
          ) VALUES (
            ${String(p.nombre)},
            ${String(p.municipio)},
            ${String(p.localidad)},
            ${String(p.telefono ?? "")},
            ${tecnicoId},
            ${syncId},
            ${(p.telefono_secundario as string | null) ?? null},
            ${(p.direccion as string | null) ?? null},
            ${(p.cp as string | null) ?? null},
            ${(p.coord_parcela as string | null) ?? null}
          )
          RETURNING id, updated_at
        `;

        await sql`
          INSERT INTO asignaciones_beneficiario (tecnico_id, beneficiario_id, asignado_por, activo)
          VALUES (${tecnicoId}, ${nuevo.id}, ${tecnicoId}, true)
          ON CONFLICT (tecnico_id, beneficiario_id) WHERE (activo = true)
          DO UPDATE SET activo = true
        `;

        if (p.cadena_productiva_id) {
          const [cadena] = await sql`SELECT id FROM cadenas_productivas WHERE id = ${String(p.cadena_productiva_id)} LIMIT 1`;
          if (cadena) {
            await sql`
              INSERT INTO beneficiario_cadenas (beneficiario_id, cadena_id, activo)
              VALUES (${nuevo.id}, ${cadena.id}, true)
              ON CONFLICT (beneficiario_id, cadena_id) DO UPDATE SET activo = true
            `;
          }
        }

        resultados.push({
          sync_id: String(p.sync_id),
          id: nuevo.id,
          remote_id: nuevo.id,
          entidad: "beneficiario",
          operacion: op.operacion,
          exito: true,
          estado: "sincronizado",
          updated_at: nuevo.updated_at,
        });

        await sql`
          INSERT INTO notificaciones (destino_id, destino_tipo, tipo, titulo, cuerpo)
          VALUES (${tecnicoId}, 'tecnico', 'beneficiario_creado', 'Nuevo beneficiario registrado', ${String(p.nombre) + ' ha sido registrado exitosamente'})
        `;

} else if (op.operacion === "crear_bitacora") {
        const p = op.payload;
        const syncId = validarSyncId(p.sync_id);
        if (!syncId) throw new Error("sync_id requerido");

        const [existente] = await sql.unsafe(`
          SELECT id, tipo, estado, fecha_inicio, fecha_fin, sync_id
          FROM bitacoras
          WHERE sync_id = $1 AND tecnico_id = $2
        `, [syncId, tecnicoId]);
        if (existente) {
          resultados.push({
            sync_id: String(p.sync_id),
            id: existente.id,
            bitacora_id: existente.id,
            remote_id: existente.id,
            entidad: "bitacora",
            operacion: op.operacion,
            exito: true,
            estado: existente.estado,
          });
          continue;
        }

        const beneficiarioId = validarUUID(p.beneficiario_id) ? p.beneficiario_id : null;
        const cadenaProductivaId = validarUUID(p.cadena_productiva_id) ? p.cadena_productiva_id : null;
        const actividadId = validarUUID(p.actividad_id) ? p.actividad_id : null;

        const firmaUrlValue = p.firma_url 
          ? await processImageFromDataUri(p.firma_url as string, 'firma', syncId)
          : null;
        const fotoRostroUrlValue = p.foto_rostro_url
          ? await processImageFromDataUri(p.foto_rostro_url as string, 'rostro', syncId)
          : null;
        const fotosCampoUrls = p.fotos_campo && Array.isArray(p.fotos_campo)
          ? await processFotosCampoFromDataUri(p.fotos_campo as string[], syncId, tecnicoId)
          : null;

        const [creada] = await sql<{ id: string; estado: string; updated_at: string }[]>`
          INSERT INTO bitacoras (
            tecnico_id, tipo, estado, fecha_inicio, coord_inicio, sync_id, creada_offline,
            beneficiario_id, cadena_productiva_id, actividad_id,
            actividades_desc, recomendaciones, comentarios_beneficiario,
            coordinacion_interinst, instancia_coordinada, proposito_coordinacion,
            observaciones_coordinador, foto_rostro_url, firma_url,
            calificacion, reporte, datos_extendidos, fotos_campo
          ) VALUES (
            ${tecnicoId}, ${String(p.tipo)}, 'borrador', ${String((p.fecha_inicio as string | null) ?? op.timestamp)},
            ${(p.coord_inicio as string | null) ?? null},
            ${syncId},
            ${(p.creada_offline as boolean | null) ?? false},
            ${beneficiarioId},
            ${cadenaProductivaId},
            ${actividadId},
            ${(p.actividades_desc as string | null) ?? ''},
            ${(p.recomendaciones as string | null) ?? ''},
            ${(p.comentarios_beneficiario as string | null) ?? ''},
            ${(p.coordinacion_interinst as boolean | null) ?? false},
            ${(p.instancia_coordinada as string | null) ?? ''},
            ${(p.proposito_coordinacion as string | null) ?? ''},
            ${(p.observaciones_coordinador as string | null) ?? null},
            ${fotoRostroUrlValue},
            ${firmaUrlValue},
            ${(p.calificacion as number | null) ?? null},
            ${(p.reporte as string | null) ?? ''},
            ${(p.datos_extendidos as Record<string, unknown> | null) ? JSON.stringify(p.datos_extendidos) : null},
            ${fotosCampoUrls ? JSON.stringify(fotosCampoUrls) : null}
          )
          RETURNING id, estado, updated_at
        `;
        resultados.push({
          sync_id: String(p.sync_id),
          id: creada.id,
          bitacora_id: creada.id,
          remote_id: creada.id,
          entidad: "bitacora",
          operacion: op.operacion,
          exito: true,
          estado: creada.estado,
          updated_at: creada.updated_at,
        });

} else if (op.operacion === "editar_bitacora") {
        const p = op.payload;
        const syncId = validarSyncId(p.sync_id);
        if (!syncId) throw new Error("sync_id requerido");

        const [bitacora] = await sql.unsafe(`
          SELECT id, estado FROM bitacoras WHERE sync_id = $1 AND tecnico_id = $2
        `, [syncId, tecnicoId]);
        if (!bitacora) throw new Error("Bitácora no encontrada");
        if (bitacora.estado !== "borrador") throw new Error("Solo se pueden editar borradores");

        const firmaUrlValue = p.firma_url 
          ? await processImageFromDataUri(p.firma_url as string, 'firma', syncId)
          : null;
        const fotoRostroUrlValue = p.foto_rostro_url
          ? await processImageFromDataUri(p.foto_rostro_url as string, 'rostro', syncId)
          : null;
        const fotosCampoUrls = p.fotos_campo && Array.isArray(p.fotos_campo)
          ? await processFotosCampoFromDataUri(p.fotos_campo as string[], syncId, tecnicoId)
          : null;

        const [actualizada] = await sql.unsafe(`
          UPDATE bitacoras SET
            actividades_desc = COALESCE(NULLIF($1, ''), actividades_desc),
            coord_inicio = COALESCE($2, coord_inicio),
            coord_fin = COALESCE($3, coord_fin),
            fecha_inicio = COALESCE($4, fecha_inicio),
            fecha_fin = COALESCE($5, fecha_fin),
            recomendaciones = COALESCE(NULLIF($6, ''), recomendaciones),
            comentarios_beneficiario = COALESCE(NULLIF($7, ''), comentarios_beneficiario),
            coordinacion_interinst = $8,
            instancia_coordinada = COALESCE(NULLIF($9, ''), instancia_coordinada),
            proposito_coordinacion = COALESCE(NULLIF($10, ''), proposito_coordinacion),
            observaciones_coordinador = $11,
            foto_rostro_url = COALESCE($12, foto_rostro_url),
            firma_url = COALESCE($13, firma_url),
            calificacion = $14,
            reporte = COALESCE(NULLIF($15, ''), reporte),
            datos_extendidos = $16,
            fotos_campo = COALESCE($17, fotos_campo),
            updated_at = NOW()
          WHERE sync_id = $18 AND tecnico_id = $19
          RETURNING id, estado, updated_at
        `, [
          p.actividades_desc as string | null,
          p.coord_inicio as string | null,
          p.coord_fin as string | null,
          p.fecha_inicio as string | null,
          p.fecha_fin as string | null,
          p.recomendaciones as string | null,
          p.comentarios_beneficiario as string | null,
          (p.coordinacion_interinst as boolean | null) ?? false,
          p.instancia_coordinada as string | null,
          p.proposito_coordinacion as string | null,
          p.observaciones_coordinador as string | null,
          fotoRostroUrlValue,
          firmaUrlValue,
          (p.calificacion as number | null) ?? null,
          p.reporte as string | null,
          p.datos_extendidos ? JSON.stringify(p.datos_extendidos) : null,
          fotosCampoUrls ? JSON.stringify(fotosCampoUrls) : null,
          syncId,
          tecnicoId
        ]);
        resultados.push({
          sync_id: String(p.sync_id),
          id: actualizada.id,
          bitacora_id: actualizada.id,
          remote_id: actualizada.id,
          entidad: "bitacora",
          operacion: op.operacion,
          exito: true,
          estado: actualizada.estado,
          updated_at: actualizada.updated_at,
        });

} else if (op.operacion === "cerrar_bitacora") {
        const p = op.payload;
        const syncId = validarSyncId(p.sync_id);
        if (!syncId) throw new Error("sync_id requerido");

        const [bitacora] = await sql.unsafe(`
          SELECT id, estado FROM bitacoras WHERE sync_id = $1 AND tecnico_id = $2
        `, [syncId, tecnicoId]);
        if (!bitacora) throw new Error("Bitácora no encontrada");
        if (bitacora.estado !== "borrador") throw new Error("La bitácora ya está cerrada");

        const actividadDesc = (p.actividades_desc as string | null) ?? '';
        const recomendacionesTxt = (p.recomendaciones as string | null) ?? '';
        const comentariosTxt = (p.comentarios_beneficiario as string | null) ?? '';
        const instanciaTxt = (p.instancia_coordinada as string | null) ?? '';
        const propositoTxt = (p.proposito_coordinacion as string | null) ?? '';
        const reporteTxt = (p.reporte as string | null) ?? '';
        const datosExt = (p.datos_extendidos as Record<string, unknown> | null) ? JSON.stringify(p.datos_extendidos) : null;
        const calif = (p.calificacion as number | null) ?? null;
        const obsCoordTxt = (p.observaciones_coordinador as string | null) ?? '';

        const firmaUrlValue = p.firma_url && (p.firma_url as string).startsWith('data:')
          ? await processImageFromDataUri(p.firma_url as string, 'firma', syncId)
          : (p.firma_url as string | null);
        const fotoRostroUrlValue = p.foto_rostro_url && (p.foto_rostro_url as string).startsWith('data:')
          ? await processImageFromDataUri(p.foto_rostro_url as string, 'rostro', syncId)
          : (p.foto_rostro_url as string | null);
        const fotosCampoUrls = p.fotos_campo && Array.isArray(p.fotos_campo)
          ? await processFotosCampoFromDataUri(p.fotos_campo as string[], syncId, tecnicoId)
          : null;

        const [cerrada] = await sql.unsafe(`
          UPDATE bitacoras SET
            estado = 'cerrada',
            fecha_fin = $1,
            coord_fin = $2,
            actividades_desc = CASE WHEN $3 = '' THEN actividades_desc ELSE $3 END,
            recomendaciones = CASE WHEN $4 = '' THEN recomendaciones ELSE $4 END,
            comentarios_beneficiario = CASE WHEN $5 = '' THEN comentarios_beneficiario ELSE $5 END,
            coordinacion_interinst = $6,
            instancia_coordinada = CASE WHEN $7 = '' THEN instancia_coordinada ELSE $7 END,
            proposito_coordinacion = CASE WHEN $8 = '' THEN proposito_coordinacion ELSE $8 END,
            observaciones_coordinador = CASE WHEN $9 = '' THEN observaciones_coordinador ELSE $9 END,
            foto_rostro_url = CASE WHEN $10 IS NULL THEN foto_rostro_url ELSE $10 END,
            firma_url = CASE WHEN $11 IS NULL THEN firma_url ELSE $11 END,
            calificacion = $12,
            reporte = CASE WHEN $13 = '' THEN reporte ELSE $13 END,
            datos_extendidos = $14,
            fotos_campo = CASE WHEN $15 IS NULL THEN fotos_campo ELSE $15 END,
            updated_at = NOW()
          WHERE sync_id = $16 AND tecnico_id = $17
          RETURNING id, estado, updated_at
        `, [
          String(p.fecha_fin),
          p.coord_fin as string | null,
          actividadDesc,
          recomendacionesTxt,
          comentariosTxt,
          (p.coordinacion_interinst as boolean | null) ?? false,
          instanciaTxt,
          propositoTxt,
          obsCoordTxt,
          fotoRostroUrlValue,
          firmaUrlValue,
          calif,
          reporteTxt,
          datosExt,
          fotosCampoUrls ? JSON.stringify(fotosCampoUrls) : null,
          syncId,
          tecnicoId
        ]);
        resultados.push({
          sync_id: String(p.sync_id),
          id: cerrada.id,
          bitacora_id: cerrada.id,
          remote_id: cerrada.id,
          entidad: "bitacora",
          operacion: op.operacion,
          exito: true,
          estado: cerrada.estado,
          updated_at: cerrada.updated_at,
        });

      } else {
        resultados.push({ operacion: op.operacion, exito: false, error: "Operación no soportada" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      resultados.push({ operacion: op.operacion, exito: false, error: msg });
    }
  }

  return { procesadas: resultados.length, resultados };
}

export async function obtenerDeltaSync(tecnicoId: string, ultimoSync?: string) {
  const desde = ultimoSync ? new Date(ultimoSync) : new Date(0);
  if (isNaN(desde.getTime())) {
    return { error: "Formato de fecha inválido. Usa ISO 8601, ej: 2026-03-01T00:00:00Z" };
  }

  const [
    beneficiarios,
    actividades,
    cadenas,
    localidades,
    bitacoras,
    asignacionesBeneficiario,
    asignacionesActividad,
  ] = await Promise.all([
    sql`
      SELECT DISTINCT ON (b.id) b.id, b.nombre, b.municipio, b.localidad, b.updated_at
      FROM beneficiarios b
      JOIN asignaciones_beneficiario ab ON ab.beneficiario_id = b.id
      WHERE ab.tecnico_id = ${tecnicoId}
        AND ab.activo = true
        AND b.activo = true
        AND b.updated_at > ${desde.toISOString()}
    `,
    sql`
      SELECT a.id, a.nombre, a.descripcion, a.updated_at
      FROM actividades a
      JOIN asignaciones_actividad aa ON aa.actividad_id = a.id
      WHERE aa.tecnico_id = ${tecnicoId}
        AND aa.activo = true
        AND a.updated_at > ${desde.toISOString()}
    `,
    sql`
      SELECT id, nombre, descripcion, updated_at
      FROM cadenas_productivas
      WHERE activo = true AND updated_at > ${desde.toISOString()}
    `,
    sql`
      SELECT id, municipio, nombre, cp, updated_at
      FROM localidades
      WHERE activo = true AND updated_at > ${desde.toISOString()}
      ORDER BY municipio, nombre
    `,
sql`
      SELECT id, sync_id, tipo, estado, fecha_inicio, fecha_fin, coord_inicio, coord_fin,
             actividades_desc, recomendaciones, comentarios_beneficiario,
             coordinacion_interinst, instancia_coordinada, proposito_coordinacion,
             observaciones_coordinador, foto_rostro_url, firma_url, fotos_campo,
             pdf_version, pdf_url_actual, pdf_original_url, pdf_edicion,
             calificacion, reporte, datos_extendidos, created_at, updated_at
      FROM bitacoras
      WHERE tecnico_id = ${tecnicoId}
        AND updated_at > ${desde.toISOString()}
      ORDER BY updated_at ASC
    `,
    sql`
      SELECT
        ab.id,
        ab.tecnico_id,
        ab.beneficiario_id,
        ab.activo,
        ab.asignado_por,
        ab.asignado_en,
        ab.removido_en
      FROM asignaciones_beneficiario ab
      WHERE ab.tecnico_id = ${tecnicoId}
        AND GREATEST(
          COALESCE(ab.asignado_en, TIMESTAMP 'epoch'),
          COALESCE(ab.removido_en, TIMESTAMP 'epoch')
        ) > ${desde.toISOString()}
      ORDER BY ab.asignado_en ASC
    `,
    sql`
      SELECT
        aa.id,
        aa.tecnico_id,
        aa.actividad_id,
        aa.activo,
        aa.asignado_por,
        aa.asignado_en,
        aa.removido_en
      FROM asignaciones_actividad aa
      WHERE aa.tecnico_id = ${tecnicoId}
        AND GREATEST(
          COALESCE(aa.asignado_en, TIMESTAMP 'epoch'),
          COALESCE(aa.removido_en, TIMESTAMP 'epoch')
        ) > ${desde.toISOString()}
      ORDER BY aa.asignado_en ASC
    `,
  ]);

  return {
    sync_ts: new Date().toISOString(),
    beneficiarios,
    actividades,
    cadenas,
    localidades,
    bitacoras,
    asignaciones: {
      beneficiarios: asignacionesBeneficiario,
      actividades: asignacionesActividad,
    },
  };
}
