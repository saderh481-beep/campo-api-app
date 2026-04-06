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

  const resultados: { sync_id?: string; operacion: string; exito: boolean; error?: string }[] = [];

  for (const op of ordenadas) {
    try {
      if (op.operacion === "crear_bitacora") {
        const p = op.payload;

        if (!p.sync_id) throw new Error("sync_id requerido");
        const [existente] = await sql`SELECT id FROM bitacoras WHERE sync_id = ${String(p.sync_id)}`;
        if (existente) {
          resultados.push({ sync_id: String(p.sync_id), operacion: op.operacion, exito: true });
          continue;
        }

        await sql`
          INSERT INTO bitacoras (
            tecnico_id, tipo, estado, fecha_inicio, coord_inicio, sync_id,
            beneficiario_id, cadena_productiva_id, actividad_id
          ) VALUES (
            ${tecnicoId}, ${String(p.tipo)}, 'borrador', ${String(p.fecha_inicio)},
            ${(p.coord_inicio as string | null) ?? null},
            ${String(p.sync_id)},
            ${(p.beneficiario_id as string | null) ?? null},
            ${(p.cadena_productiva_id as string | null) ?? null},
            ${(p.actividad_id as string | null) ?? null}
          )
        `;
        resultados.push({ sync_id: String(p.sync_id), operacion: op.operacion, exito: true });

      } else if (op.operacion === "editar_bitacora") {
        const p = op.payload;

        if (!p.sync_id) throw new Error("sync_id requerido");
        const [bitacora] = await sql<BitacoraResumen[]>`
          SELECT id, estado FROM bitacoras WHERE sync_id = ${String(p.sync_id)} AND tecnico_id = ${tecnicoId}
        `;
        if (!bitacora) throw new Error("Bitácora no encontrada");
        if (bitacora.estado !== "borrador") throw new Error("Solo se pueden editar borradores");

        await sql`
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
        `;
        resultados.push({ sync_id: String(p.sync_id), operacion: op.operacion, exito: true });

      } else if (op.operacion === "cerrar_bitacora") {
        const p = op.payload;

        if (!p.sync_id) throw new Error("sync_id requerido");
        const [bitacora] = await sql<BitacoraResumen[]>`
          SELECT id, estado FROM bitacoras WHERE sync_id = ${String(p.sync_id)} AND tecnico_id = ${tecnicoId}
        `;
        if (!bitacora) throw new Error("Bitácora no encontrada");
        if (bitacora.estado !== "borrador") throw new Error("La bitácora ya está cerrada");

        await sql`
          UPDATE bitacoras SET
            estado = 'cerrada',
            fecha_fin = ${String(p.fecha_fin)},
            coord_fin = ${(p.coord_fin as string | null) ?? null},
            updated_at = NOW()
          WHERE sync_id = ${String(p.sync_id)}
        `;
        resultados.push({ sync_id: String(p.sync_id), operacion: op.operacion, exito: true });

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

  const [beneficiarios, actividades, cadenas] = await Promise.all([
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
  ]);

  return {
    sync_ts: new Date().toISOString(),
    beneficiarios,
    actividades,
    cadenas,
  };
}
