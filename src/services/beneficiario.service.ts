import { sql } from "@/db";
import { redis } from "@/lib/redis";
import type {
  BeneficiarioConCadenas,
  Actividad,
  CadenaProductiva,
  Localidad,
  AsignacionBeneficiarioDetalle,
  AsignacionActividadDetalle,
} from "@/models";

function generateFolioSaderh(): string {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SADERH-${year}-${random}`;
}

export async function obtenerAsignacionesTecnico(tecnicoId: string) {
  const [beneficiarios, actividades] = await Promise.all([
    sql<AsignacionBeneficiarioDetalle[]>`
      SELECT DISTINCT ON (ab.beneficiario_id)
        ab.id,
        ab.tecnico_id,
        ab.beneficiario_id,
        ab.activo,
        ab.asignado_por,
        ab.asignado_en,
        ab.removido_en,
        b.nombre AS beneficiario_nombre,
        b.municipio,
        b.localidad
      FROM asignaciones_beneficiario ab
      JOIN beneficiarios b ON b.id = ab.beneficiario_id
      WHERE ab.tecnico_id = ${tecnicoId}
        AND ab.activo = true
        AND b.activo = true
      ORDER BY ab.beneficiario_id, ab.asignado_en DESC
    `,
    sql<AsignacionActividadDetalle[]>`
      SELECT
        aa.id,
        aa.tecnico_id,
        aa.actividad_id,
        aa.activo,
        aa.asignado_por,
        aa.asignado_en,
        aa.removido_en,
        a.nombre AS actividad_nombre,
        a.descripcion AS actividad_descripcion
      FROM asignaciones_actividad aa
      JOIN actividades a ON a.id = aa.actividad_id
      WHERE aa.tecnico_id = ${tecnicoId}
        AND aa.activo = true
      ORDER BY aa.asignado_en DESC, a.nombre ASC
    `,
  ]);

  return {
    tecnico_id: tecnicoId,
    beneficiarios,
    actividades,
  };
}

function cadenaPrincipal(beneficiario: BeneficiarioConCadenas) {
  return Array.isArray(beneficiario.cadenas) && beneficiario.cadenas.length > 0
    ? beneficiario.cadenas[0]?.nombre ?? null
    : null;
}

export async function obtenerAsignacionesTecnicoParaApp(tecnicoId: string) {
  const [asignaciones, beneficiarios] = await Promise.all([
    obtenerAsignacionesTecnico(tecnicoId),
    obtenerBeneficiariosTecnico(tecnicoId),
  ]);

  const beneficiariosMap = new Map(
    beneficiarios.map((beneficiario) => [beneficiario.id, beneficiario] as const)
  );

  const beneficiarioItems = asignaciones.beneficiarios.map((item) => {
    const beneficiario = beneficiariosMap.get(item.beneficiario_id);

    return {
      id: item.id,
      id_asignacion: item.id,
      id_tecnico: item.tecnico_id,
      tipo_asignacion: "beneficiario",
      nombre: item.beneficiario_nombre,
      descripcion: null,
      descripcion_actividad: null,
      prioridad: "MEDIA",
      fecha_limite: null,
      completado: false,
      activo: item.activo,
      created_by: item.asignado_por,
      created_at: item.asignado_en,
      updated_at: item.removido_en ?? item.asignado_en,
      beneficiario: {
        id: item.beneficiario_id,
        id_beneficiario: item.beneficiario_id,
        nombre: beneficiario?.nombre ?? item.beneficiario_nombre,
        nombre_completo: beneficiario?.nombre ?? item.beneficiario_nombre,
        municipio: beneficiario?.municipio ?? item.municipio,
        localidad: beneficiario?.localidad ?? item.localidad,
        folio_saderh: null,
        cadena_productiva: beneficiario ? cadenaPrincipal(beneficiario) : null,
        activo: beneficiario?.activo ?? true,
      },
    };
  });

  const actividadItems = asignaciones.actividades.map((item) => ({
    id: item.id,
    id_asignacion: item.id,
    id_tecnico: item.tecnico_id,
    tipo_asignacion: "actividad",
    nombre: item.actividad_nombre,
    descripcion: item.actividad_descripcion,
    descripcion_actividad: item.actividad_descripcion,
    prioridad: "MEDIA",
    fecha_limite: null,
    completado: false,
    activo: item.activo,
    created_by: item.asignado_por,
    created_at: item.asignado_en,
    updated_at: item.removido_en ?? item.asignado_en,
    beneficiario: null,
  }));

  const items = [...actividadItems, ...beneficiarioItems];

  return {
    success: true,
    id_tecnico: tecnicoId,
    asignaciones: items,
    total: items.length,
  };
}

export async function obtenerBeneficiariosTecnico(tecnicoId: string) {
  try {
    return await sql<BeneficiarioConCadenas[]>`
      SELECT DISTINCT ON (b.id) b.id, b.nombre, b.municipio, b.localidad, b.direccion, b.cp,
             b.telefono_principal, b.telefono_secundario,
             CASE
               WHEN b.coord_parcela IS NULL THEN NULL
               ELSE CONCAT('(', b.coord_parcela[0], ',', b.coord_parcela[1], ')')
             END AS coord_parcela,
             b.activo,
             COALESCE((
               SELECT json_agg(json_build_object('id', cp.id, 'nombre', cp.nombre) ORDER BY cp.nombre)
               FROM beneficiario_cadenas bc
               JOIN cadenas_productivas cp ON cp.id = bc.cadena_id
               WHERE bc.beneficiario_id = b.id
                 AND bc.activo = true
                 AND cp.activo = true
             ), '[]'::json) AS cadenas
      FROM asignaciones_beneficiario ab
      JOIN beneficiarios b ON b.id = ab.beneficiario_id
      WHERE ab.tecnico_id = ${tecnicoId}
        AND ab.activo = true
        AND b.activo = true
      ORDER BY b.id, b.nombre
    `;
  } catch (error) {
    if ((error as { code?: string })?.code !== "42703") {
      throw error;
    }
  }

  return await sql<BeneficiarioConCadenas[]>`
    SELECT DISTINCT ON (b.id) b.id, b.nombre, b.municipio, b.localidad, b.direccion, b.cp,
           b.telefono_principal, b.telefono_secundario,
           CASE
             WHEN b.coord_parcela IS NULL THEN NULL
             ELSE CONCAT('(', b.coord_parcela[0], ',', b.coord_parcela[1], ')')
           END AS coord_parcela,
           true AS activo,
           COALESCE((
             SELECT json_agg(json_build_object('id', cp.id, 'nombre', cp.nombre) ORDER BY cp.nombre)
             FROM beneficiario_cadenas bc
             JOIN cadenas_productivas cp ON cp.id = bc.cadena_id
             WHERE bc.beneficiario_id = b.id
           ), '[]'::json) AS cadenas
    FROM asignaciones_beneficiario ab
    JOIN beneficiarios b ON b.id = ab.beneficiario_id
    WHERE ab.tecnico_id = ${tecnicoId}
      AND b.activo = true
    ORDER BY b.id, b.nombre
  `;
}

export async function obtenerBeneficiariosTecnicoParaApp(tecnicoId: string) {
  const beneficiarios = await obtenerBeneficiariosTecnico(tecnicoId);

  const items = beneficiarios.map((beneficiario) => ({
    id: beneficiario.id,
    id_tecnico: tecnicoId,
    id_beneficiario: beneficiario.id,
    nombre: beneficiario.nombre,
    nombre_completo: beneficiario.nombre,
    municipio: beneficiario.municipio,
    localidad: beneficiario.localidad,
    direccion: beneficiario.direccion,
    cp: beneficiario.cp,
    coord_parcela: beneficiario.coord_parcela,
    curp: beneficiario.curp,
    folio_saderh: beneficiario.folio_saderh,
    cadena_productiva: cadenaPrincipal(beneficiario),
    telefono_principal: beneficiario.telefono_principal,
    telefono_secundario: beneficiario.telefono_secundario,
    activo: beneficiario.activo,
  }));

  return {
    success: true,
    id_tecnico: tecnicoId,
    beneficiaries: items,
    total: items.length,
  };
}

export async function obtenerBeneficiariosTecnicoPaginado(
  tecnicoId: string,
  options: { limit?: number; offset?: number; buscar?: string } = {}
) {
  const { limit = 50, offset = 0, buscar } = options;

  let countQuery = `
    SELECT COUNT(*)::int as total
    FROM asignaciones_beneficiario ab
    JOIN beneficiarios b ON b.id = ab.beneficiario_id
    WHERE ab.tecnico_id = $1 AND ab.activo = true AND b.activo = true
  `;
  
  let dataQuery = `
    SELECT DISTINCT ON (b.id) b.id, b.nombre, b.municipio, b.localidad, b.direccion, b.cp,
           b.telefono_principal, b.telefono_secundario,
           b.curp, b.folio_saderh,
           CASE
             WHEN b.coord_parcela IS NULL THEN NULL
             ELSE CONCAT('(', b.coord_parcela[0], ',', b.coord_parcela[1], ')')
           END AS coord_parcela,
           b.activo,
           COALESCE((
             SELECT json_agg(json_build_object('id', cp.id, 'nombre', cp.nombre) ORDER BY cp.nombre)
             FROM beneficiario_cadenas bc
             JOIN cadenas_productivas cp ON cp.id = bc.cadena_id
             WHERE bc.beneficiario_id = b.id
               AND bc.activo = true
               AND cp.activo = true
           ), '[]'::json) AS cadenas
    FROM asignaciones_beneficiario ab
    JOIN beneficiarios b ON b.id = ab.beneficiario_id
    WHERE ab.tecnico_id = $1 AND ab.activo = true AND b.activo = true
  `;

  const params: any[] = [tecnicoId];
  let paramIndex = 2;

  if (buscar && buscar.trim().length > 0) {
    const searchTerm = `%${buscar.trim().toLowerCase()}%`;
    countQuery += ` AND (LOWER(b.nombre) LIKE $${paramIndex} OR LOWER(b.municipio) LIKE $${paramIndex} OR LOWER(b.localidad) LIKE $${paramIndex})`;
    dataQuery += ` AND (LOWER(b.nombre) LIKE $${paramIndex} OR LOWER(b.municipio) LIKE $${paramIndex} OR LOWER(b.localidad) LIKE $${paramIndex})`;
    params.push(searchTerm);
    paramIndex++;
  }

  const [countResult] = await sql.unsafe(countQuery, params);
  const total = countResult?.total || 0;

  dataQuery += ` ORDER BY b.id, b.nombre LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const beneficiaries = await sql.unsafe(dataQuery, params);

  const items = beneficiaries.map((beneficiario: any) => ({
    id: beneficiario.id,
    id_tecnico: tecnicoId,
    id_beneficiario: beneficiario.id,
    nombre: beneficiario.nombre,
    nombre_completo: beneficiario.nombre,
    municipio: beneficiario.municipio,
    localidad: beneficiario.localidad,
    direccion: beneficiario.direccion,
    cp: beneficiario.cp,
    coord_parcela: beneficiario.coord_parcela,
    curp: beneficiario.curp,
    folio_saderh: beneficiario.folio_saderh,
    cadena_productiva: cadenaPrincipal(beneficiario),
    telefono_principal: beneficiario.telefono_principal,
    telefono_secundario: beneficiario.telefono_secundario,
    activo: beneficiario.activo,
  }));

  return {
    success: true,
    id_tecnico: tecnicoId,
    beneficiaries: items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

export async function obtenerBeneficiarioPorId(tecnicoId: string, beneficiarioId: string) {
  const [beneficiario] = await sql<BeneficiarioConCadenas[]>`
    SELECT b.id, b.nombre, b.curp, b.folio_saderh, b.municipio, b.localidad, b.direccion, b.cp,
           b.telefono_principal, b.telefono_secundario,
           CASE
             WHEN b.coord_parcela IS NULL THEN NULL
             ELSE CONCAT('(', b.coord_parcela[0], ',', b.coord_parcela[1], ')')
           END AS coord_parcela,
           b.activo,
           COALESCE((
             SELECT json_agg(json_build_object('id', cp.id, 'nombre', cp.nombre) ORDER BY cp.nombre)
             FROM beneficiario_cadenas bc
             JOIN cadenas_productivas cp ON cp.id = bc.cadena_id
             WHERE bc.beneficiario_id = b.id
               AND bc.activo = true
               AND cp.activo = true
           ), '[]'::json) AS cadenas
    FROM beneficiarios b
    JOIN asignaciones_beneficiario ab ON ab.beneficiario_id = b.id
    WHERE b.id = ${beneficiarioId}
      AND ab.tecnico_id = ${tecnicoId}
      AND ab.activo = true
      AND b.activo = true
    LIMIT 1
  `;

  if (!beneficiario) return null;

  return {
    id: beneficiario.id,
    id_tecnico: tecnicoId,
    id_beneficiario: beneficiario.id,
    nombre: beneficiario.nombre,
    nombre_completo: beneficiario.nombre,
    municipio: beneficiario.municipio,
    localidad: beneficiario.localidad,
    direccion: beneficiario.direccion,
    cp: beneficiario.cp,
    coord_parcela: beneficiario.coord_parcela,
    curp: beneficiario.curp,
    folio_saderh: beneficiario.folio_saderh,
    cadena_productiva: cadenaPrincipal(beneficiario),
    telefono_principal: beneficiario.telefono_principal,
    telefono_secundario: beneficiario.telefono_secundario,
    activo: beneficiario.activo,
    cadenas: beneficiario.cadenas,
  };
}

export async function crearBeneficiario(
  tecnicoId: string,
  data: {
    nombre: string;
    municipio: string;
    localidad: string;
    telefono: string;
    cadena_productiva?: string;
    curp?: string;
    folio_saderh?: string;
  }
) {
  const folioSaderh = data.folio_saderh || generateFolioSaderh();
  const curp = data.curp || null;

  const [nuevoBeneficiario] = await sql`
    INSERT INTO beneficiarios (
      nombre, curp, folio_saderh, municipio, localidad, telefono_principal, tecnico_id
    ) VALUES (
      ${data.nombre},
      ${curp},
      ${folioSaderh},
      ${data.municipio},
      ${data.localidad},
      ${data.telefono},
      ${tecnicoId}
    )
    RETURNING id
  `;

  // Crear asignación automáticamente
  await sql`
    INSERT INTO asignaciones_beneficiario (
      tecnico_id, beneficiario_id, asignado_por, activo
    ) VALUES (
      ${tecnicoId},
      ${nuevoBeneficiario.id},
      ${tecnicoId},
      true
    )
    ON CONFLICT (tecnico_id, beneficiario_id) WHERE (activo = true)
    DO UPDATE SET activo = true, asignado_por = ${tecnicoId}
  `;

  // Asignar cadena productiva si se proporcionó
  if (data.cadena_productiva) {
    const [cadena] = await sql`
      SELECT id
      FROM cadenas_productivas
      WHERE activo = true
        AND LOWER(nombre) = LOWER(${data.cadena_productiva})
      LIMIT 1
    `;

    if (cadena) {
      await sql`
        INSERT INTO beneficiario_cadenas (beneficiario_id, cadena_id, activo)
        VALUES (${nuevoBeneficiario.id}, ${cadena.id}, true)
        ON CONFLICT (beneficiario_id, cadena_id)
        DO UPDATE SET activo = true
      `;
    }
  }

  // Retornar beneficiario completo
  const [beneficiario] = await sql<BeneficiarioConCadenas[]>`
    SELECT b.id, b.nombre, b.curp, b.folio_saderh, b.municipio, b.localidad, b.direccion, b.cp,
           b.telefono_principal, b.telefono_secundario,
           CASE
             WHEN b.coord_parcela IS NULL THEN NULL
             ELSE CONCAT('(', b.coord_parcela[0], ',', b.coord_parcela[1], ')')
           END AS coord_parcela,
           b.activo,
           COALESCE((
             SELECT json_agg(json_build_object('id', cp.id, 'nombre', cp.nombre) ORDER BY cp.nombre)
             FROM beneficiario_cadenas bc
             JOIN cadenas_productivas cp ON cp.id = bc.cadena_id
             WHERE bc.beneficiario_id = b.id
               AND bc.activo = true
               AND cp.activo = true
           ), '[]'::json) AS cadenas
    FROM beneficiarios b
    WHERE b.id = ${nuevoBeneficiario.id}
    LIMIT 1
  `;

  return beneficiario;
}

export async function obtenerActividadesTecnico(tecnicoId: string) {
  const actividades = await sql<Actividad[]>`
    SELECT a.id, a.nombre, a.descripcion, a.activo, a.created_by, a.created_at, a.updated_at
    FROM asignaciones_actividad aa
    JOIN actividades a ON a.id = aa.actividad_id
    WHERE aa.tecnico_id = ${tecnicoId} AND aa.activo = true
    ORDER BY a.nombre
  `;
  return actividades;
}

export async function obtenerCadenasProductivas() {
  try {
    const cached = await redis.get("cadenas:lista");
    if (cached) return JSON.parse(cached);
  } catch (error) {
    console.error("[beneficiarios] No se pudo leer cache Redis:", error);
  }

  const cadenas = await sql<CadenaProductiva[]>`
    SELECT id, nombre, descripcion, activo, created_by, created_at, updated_at 
    FROM cadenas_productivas WHERE activo = true ORDER BY nombre
  `;

  try {
    await redis.setex("cadenas:lista", 86400, JSON.stringify(cadenas));
  } catch (error) {
    console.error("[beneficiarios] No se pudo escribir cache Redis:", error);
  }

  return cadenas;
}

export async function obtenerLocalidades(municipio?: string) {
  if (municipio) {
    const localidades = await sql<Localidad[]>`
      SELECT id, municipio, nombre, cp, activo, created_by, created_at, updated_at, zona_id
      FROM localidades
      WHERE activo = true AND LOWER(municipio) = LOWER(${municipio})
      ORDER BY nombre
    `;
    return localidades;
  }

  const localidades = await sql<Localidad[]>`
    SELECT id, municipio, nombre, cp, activo, created_by, created_at, updated_at, zona_id
    FROM localidades
    WHERE activo = true
    ORDER BY municipio, nombre
  `;
  return localidades;
}

export async function verificarAsignacionBeneficiario(tecnicoId: string, beneficiarioId: string) {
  const [asignacion] = await sql`
    SELECT id
    FROM asignaciones_beneficiario
    WHERE tecnico_id = ${tecnicoId}
      AND beneficiario_id = ${beneficiarioId}
      AND activo = true
    LIMIT 1
  `;
  return !!asignacion;
}

export async function verificarAsignacionActividad(tecnicoId: string, actividadId: string) {
  const [asignacion] = await sql`
    SELECT id
    FROM asignaciones_actividad
    WHERE tecnico_id = ${tecnicoId}
      AND actividad_id = ${actividadId}
      AND activo = true
    LIMIT 1
  `;
  return !!asignacion;
}
