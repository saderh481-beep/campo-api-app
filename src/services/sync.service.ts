import { sql } from "@/db";
import type { BitacoraResumen } from "@/models";

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
      if (op.operacion === "crear_bitacora") {
        const p = op.payload;

        if (!p.sync_id) throw new Error("sync_id requerido");
        const [existente] = await sql<BitacoraResumen[]>`
          SELECT id, estado, sync_id, fecha_inicio, fecha_fin
          FROM bitacoras
          WHERE sync_id = ${String(p.sync_id)}
            AND tecnico_id = ${tecnicoId}
        `;
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

        const [creada] = await sql<{ id: string; estado: string; updated_at: string }[]>`
          INSERT INTO bitacoras (
            tecnico_id, tipo, estado, fecha_inicio, coord_inicio, sync_id, creada_offline,
            beneficiario_id, cadena_productiva_id, actividad_id
          ) VALUES (
            ${tecnicoId}, ${String(p.tipo)}, 'borrador', ${String((p.fecha_inicio as string | null) ?? op.timestamp)},
            ${(p.coord_inicio as string | null) ?? null},
            ${String(p.sync_id)},
            true,
            ${(p.beneficiario_id as string | null) ?? null},
            ${(p.cadena_productiva_id as string | null) ?? null},
            ${(p.actividad_id as string | null) ?? null}
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

        if (!p.sync_id) throw new Error("sync_id requerido");
        const [bitacora] = await sql<BitacoraResumen[]>`
          SELECT id, estado FROM bitacoras WHERE sync_id = ${String(p.sync_id)} AND tecnico_id = ${tecnicoId}
        `;
        if (!bitacora) throw new Error("Bitácora no encontrada");
        if (bitacora.estado !== "borrador") throw new Error("Solo se pueden editar borradores");

        const [actualizada] = await sql<{ id: string; estado: string; updated_at: string }[]>`
          UPDATE bitacoras SET
            actividades_desc = COALESCE(${(p.actividades_desc as string | null) ?? null}, actividades_desc),
            coord_inicio = COALESCE(${(p.coord_inicio as string | null) ?? null}, coord_inicio),
            coord_fin = COALESCE(${(p.coord_fin as string | null) ?? null}, coord_fin),
            fecha_inicio = COALESCE(${(p.fecha_inicio as string | null) ?? null}, fecha_inicio),
            fecha_fin = COALESCE(${(p.fecha_fin as string | null) ?? null}, fecha_fin),
            recomendaciones = COALESCE(${(p.recomendaciones as string | null) ?? null}, recomendaciones),
            comentarios_beneficiario = COALESCE(${(p.comentarios_beneficiario as string | null) ?? null}, comentarios_beneficiario),
            updated_at = NOW()
          WHERE sync_id = ${String(p.sync_id)}
            AND tecnico_id = ${tecnicoId}
          RETURNING id, estado, updated_at
        `;
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

        if (!p.sync_id) throw new Error("sync_id requerido");
        const [bitacora] = await sql<BitacoraResumen[]>`
          SELECT id, estado FROM bitacoras WHERE sync_id = ${String(p.sync_id)} AND tecnico_id = ${tecnicoId}
        `;
        if (!bitacora) throw new Error("Bitácora no encontrada");
        if (bitacora.estado !== "borrador") throw new Error("La bitácora ya está cerrada");

        const [cerrada] = await sql<{ id: string; estado: string; updated_at: string }[]>`
          UPDATE bitacoras SET
            estado = 'cerrada',
            fecha_fin = ${String(p.fecha_fin)},
            coord_fin = ${(p.coord_fin as string | null) ?? null},
            updated_at = NOW()
          WHERE sync_id = ${String(p.sync_id)}
            AND tecnico_id = ${tecnicoId}
          RETURNING id, estado, updated_at
        `;
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
      SELECT DISTINCT b.id, b.nombre, b.municipio, b.localidad, b.updated_at
      FROM beneficiarios b
      JOIN asignaciones_beneficiario ab ON ab.beneficiario_id = b.id
      WHERE ab.tecnico_id = ${tecnicoId}
        AND ab.activo = true
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
             foto_rostro_url, firma_url, fotos_campo, pdf_url_actual, updated_at
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
