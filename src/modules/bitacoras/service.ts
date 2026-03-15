import { sql } from "@/config/db";
import { AppError, NotFoundError, ConflictError } from "@/lib/errors";
import type { GPS } from "@/types";

export async function listar(tecnicoId: string, params: {
  page: number; pageSize: number; estado?: string; mes?: string;
}) {
  const offset    = (params.page - 1) * params.pageSize;
  const mesInicio = params.mes ? `${params.mes}-01` : null;
  const mesFin    = params.mes
    ? (() => {
        const [y, m] = params.mes!.split("-").map(Number);
        return new Date(y, m, 0).toISOString().split("T")[0];
      })()
    : null;

  const rows = await sql`
    SELECT b.id, b.tipo, b.estado, b.fecha_inicio, b.fecha_fin,
           b.gps_inicio, b.gps_fin, b.notas, b.creado_en,
           ben.nombre AS beneficiario_nombre,
           cp.nombre  AS cadena_nombre,
           ac.nombre  AS actividad_nombre,
           EXISTS (
             SELECT 1 FROM pdf_versiones pv WHERE pv.bitacora_id = b.id LIMIT 1
           ) AS tiene_pdf
    FROM bitacoras b
    LEFT JOIN beneficiarios       ben ON ben.id = b.beneficiario_id
    LEFT JOIN cadenas_productivas cp  ON cp.id  = b.cadena_productiva_id
    LEFT JOIN actividades         ac  ON ac.id  = b.actividad_id
    WHERE b.tecnico_id = ${tecnicoId}
      ${params.estado ? sql`AND b.estado = ${params.estado}` : sql``}
      ${mesInicio     ? sql`AND b.fecha_inicio BETWEEN ${mesInicio} AND ${mesFin}` : sql``}
    ORDER BY b.fecha_inicio DESC
    LIMIT ${params.pageSize} OFFSET ${offset}
  `;

  const [{ count }] = await sql<[{ count: number }]>`
    SELECT COUNT(*)::int AS count FROM bitacoras
    WHERE tecnico_id = ${tecnicoId}
      ${params.estado ? sql`AND estado = ${params.estado}` : sql``}
      ${mesInicio     ? sql`AND fecha_inicio BETWEEN ${mesInicio} AND ${mesFin}` : sql``}
  `;

  return { data: rows, total: count, page: params.page, pageSize: params.pageSize };
}

export async function obtener(id: string, tecnicoId: string) {
  const [row] = await sql`
    SELECT b.*,
           ben.nombre AS beneficiario_nombre,
           cp.nombre  AS cadena_nombre,
           ac.nombre  AS actividad_nombre,
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT('version', pv.version, 'url', pv.url)
               ORDER BY pv.version DESC
             ) FILTER (WHERE pv.id IS NOT NULL),
             '[]'
           ) AS pdfs
    FROM bitacoras b
    LEFT JOIN beneficiarios       ben ON ben.id = b.beneficiario_id
    LEFT JOIN cadenas_productivas cp  ON cp.id  = b.cadena_productiva_id
    LEFT JOIN actividades         ac  ON ac.id  = b.actividad_id
    LEFT JOIN pdf_versiones       pv  ON pv.bitacora_id = b.id
    WHERE b.id = ${id} AND b.tecnico_id = ${tecnicoId}
    GROUP BY b.id, ben.nombre, cp.nombre, ac.nombre
  `;
  if (!row) throw new NotFoundError("Bitácora");
  return row;
}

export async function crear(
  tecnicoId: string,
  data: {
    tipo: "A" | "B";
    beneficiarioId?: string;
    cadenaProductivaId?: string;
    actividadId?: string;
    gpsInicio: GPS;
    notas?: string;
  }
) {
  // Validar unicidad por partición (mes activo)
  if (data.tipo === "A") {
    const [dup] = await sql`
      SELECT id FROM bitacoras
      WHERE tecnico_id          = ${tecnicoId}
        AND beneficiario_id     = ${data.beneficiarioId!}
        AND cadena_productiva_id= ${data.cadenaProductivaId!}
        AND DATE_TRUNC('month', fecha_inicio) = DATE_TRUNC('month', NOW())
      LIMIT 1
    `;
    if (dup) throw new ConflictError("Ya existe una bitácora Tipo A para este beneficiario y cadena en el mes actual");
  } else {
    const [dup] = await sql`
      SELECT id FROM bitacoras
      WHERE tecnico_id   = ${tecnicoId}
        AND actividad_id = ${data.actividadId!}
        AND DATE_TRUNC('month', fecha_inicio) = DATE_TRUNC('month', NOW())
      LIMIT 1
    `;
    if (dup) throw new ConflictError("Ya existe una bitácora Tipo B para esta actividad en el mes actual");
  }

  const [bitacora] = await sql`
    INSERT INTO bitacoras (
      tecnico_id, tipo, beneficiario_id, cadena_productiva_id,
      actividad_id, gps_inicio, notas
    ) VALUES (
      ${tecnicoId},
      ${data.tipo},
      ${data.beneficiarioId     ?? null},
      ${data.cadenaProductivaId ?? null},
      ${data.actividadId        ?? null},
      ${JSON.stringify(data.gpsInicio)},
      ${data.notas              ?? null}
    )
    RETURNING *
  `;
  return bitacora;
}

export async function actualizar(id: string, tecnicoId: string, notas: string | null | undefined) {
  const [row] = await sql`
    UPDATE bitacoras SET notas = COALESCE(${notas ?? null}, notas)
    WHERE id = ${id} AND tecnico_id = ${tecnicoId} AND estado = 'borrador'
    RETURNING *
  `;
  if (!row) throw new AppError("Bitácora no encontrada o ya cerrada", 400);
  return row;
}

export async function cerrar(id: string, tecnicoId: string, gpsFin: GPS) {
  const [row] = await sql`
    UPDATE bitacoras SET
      estado   = 'cerrada',
      fecha_fin = NOW(),
      gps_fin  = ${JSON.stringify(gpsFin)}
    WHERE id = ${id} AND tecnico_id = ${tecnicoId} AND estado = 'borrador'
    RETURNING *
  `;
  if (!row) throw new AppError("Bitácora no encontrada o ya cerrada", 400);
  // TODO: encolar generación de PDF (pdf-lib worker)
  return row;
}
