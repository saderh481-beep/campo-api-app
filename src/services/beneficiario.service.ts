import { sql } from "@/db";
import { redis } from "@/lib/redis";
import type { BeneficiarioConCadenas, Actividad, CadenaProductiva, Localidad } from "@/models";

export async function obtenerBeneficiariosTecnico(tecnicoId: string) {
  try {
    return await sql<BeneficiarioConCadenas[]>`
      SELECT b.id, b.nombre, b.municipio, b.localidad, b.direccion, b.cp,
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
      ORDER BY b.nombre
    `;
  } catch (error) {
    if ((error as { code?: string })?.code !== "42703") {
      throw error;
    }
  }

  return await sql<BeneficiarioConCadenas[]>`
    SELECT b.id, b.nombre, b.municipio, b.localidad, b.direccion, b.cp,
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
    ORDER BY b.nombre
  `;
}

export async function crearBeneficiario(
  tecnicoId: string,
  data: {
    nombre: string;
    municipio: string;
    localidad: string;
    telefono: string;
    cadena_productiva?: string;
  }
) {
  const [nuevoBeneficiario] = await sql`
    INSERT INTO beneficiarios (
      nombre, municipio, localidad, telefono_principal, tecnico_id
    ) VALUES (
      ${data.nombre},
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
    SELECT b.id, b.nombre, b.municipio, b.localidad, b.direccion, b.cp,
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
