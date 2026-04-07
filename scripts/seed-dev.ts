import { sql } from "../src/db";

async function upsertUsuario(input: {
  correo: string;
  nombre: string;
  rol: "tecnico" | "coordinador";
  codigo: string;
  activo?: boolean;
}) {
  const hash = await Bun.password.hash(input.codigo);

  const [usuario] = await sql<[{ id: string; correo: string; nombre: string; rol: string; codigo_acceso: string }]>`
    INSERT INTO usuarios (correo, nombre, rol, activo, codigo_acceso, hash_codigo_acceso, estado_corte)
    VALUES (
      ${input.correo},
      ${input.nombre},
      ${input.rol},
      ${input.activo ?? true},
      ${input.codigo},
      ${hash},
      'en_servicio'
    )
    ON CONFLICT (correo) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        rol = EXCLUDED.rol,
        activo = EXCLUDED.activo,
        codigo_acceso = EXCLUDED.codigo_acceso,
        hash_codigo_acceso = EXCLUDED.hash_codigo_acceso,
        estado_corte = 'en_servicio',
        updated_at = NOW()
    RETURNING id, correo, nombre, rol, codigo_acceso
  `;

  return usuario;
}

async function upsertCadena(nombre: string, descripcion: string, createdBy: string) {
  const [cadena] = await sql<[{ id: string; nombre: string }]>`
    INSERT INTO cadenas_productivas (nombre, descripcion, created_by)
    VALUES (${nombre}, ${descripcion}, ${createdBy})
    ON CONFLICT (nombre) DO UPDATE
    SET descripcion = EXCLUDED.descripcion,
        activo = true,
        updated_at = NOW()
    RETURNING id, nombre
  `;

  return cadena;
}

async function upsertActividad(nombre: string, descripcion: string, createdBy: string) {
  const [actividad] = await sql<[{ id: string; nombre: string }]>`
    INSERT INTO actividades (nombre, descripcion, created_by)
    VALUES (${nombre}, ${descripcion}, ${createdBy})
    ON CONFLICT (nombre) DO UPDATE
    SET descripcion = EXCLUDED.descripcion,
        activo = true,
        updated_at = NOW()
    RETURNING id, nombre
  `;

  return actividad;
}

async function upsertLocalidad(
  municipio: string,
  nombre: string,
  cp: string,
  createdBy: string
) {
  const [localidad] = await sql<[{ id: string; municipio: string; nombre: string }]>`
    INSERT INTO localidades (municipio, nombre, cp, created_by)
    VALUES (${municipio}, ${nombre}, ${cp}, ${createdBy})
    ON CONFLICT (municipio, nombre) DO UPDATE
    SET cp = EXCLUDED.cp,
        activo = true,
        updated_at = NOW()
    RETURNING id, municipio, nombre
  `;

  return localidad;
}

async function crearBeneficiarioDemo(input: {
  tecnicoId: string;
  nombre: string;
  municipio: string;
  localidad: string;
  telefono: string;
  cadenaId: string;
}) {
  const [existente] = await sql<[{ id: string }][]>`
    SELECT id
    FROM beneficiarios
    WHERE tecnico_id = ${input.tecnicoId}
      AND nombre = ${input.nombre}
      AND municipio = ${input.municipio}
      AND localidad = ${input.localidad}
    LIMIT 1
  `;

  const beneficiario =
    existente ??
    (
      await sql<[{ id: string }]>`
        INSERT INTO beneficiarios (
          tecnico_id,
          nombre,
          municipio,
          localidad,
          telefono_principal,
          activo
        ) VALUES (
          ${input.tecnicoId},
          ${input.nombre},
          ${input.municipio},
          ${input.localidad},
          ${input.telefono},
          true
        )
        RETURNING id
      `
    )[0];

  await sql`
    INSERT INTO asignaciones_beneficiario (tecnico_id, beneficiario_id, asignado_por, activo)
    VALUES (${input.tecnicoId}, ${beneficiario.id}, ${input.tecnicoId}, true)
    ON CONFLICT (tecnico_id, beneficiario_id) WHERE activo = true
    DO NOTHING
  `;

  await sql`
    INSERT INTO beneficiario_cadenas (beneficiario_id, cadena_id, activo)
    VALUES (${beneficiario.id}, ${input.cadenaId}, true)
    ON CONFLICT (beneficiario_id, cadena_id)
    DO UPDATE SET activo = true
  `;

  return beneficiario;
}

async function seedDev() {
  const coordinador = await upsertUsuario({
    correo: "coordinador@campo.local",
    nombre: "Coordinador Demo",
    rol: "coordinador",
    codigo: "900001",
  });

  const tecnico1 = await upsertUsuario({
    correo: "tecnico1@campo.local",
    nombre: "Tecnico Uno",
    rol: "tecnico",
    codigo: "12345",
  });

  const tecnico2 = await upsertUsuario({
    correo: "tecnico2@campo.local",
    nombre: "Tecnico Dos",
    rol: "tecnico",
    codigo: "12346",
  });

  const cadenaCafe = await upsertCadena("Cafe", "Produccion y seguimiento de cafe", coordinador.id);
  const cadenaMaiz = await upsertCadena("Maiz", "Produccion y seguimiento de maiz", coordinador.id);

  const actividadVisita = await upsertActividad(
    "Visita de seguimiento",
    "Seguimiento tecnico en campo",
    coordinador.id
  );
  const actividadCap = await upsertActividad(
    "Capacitacion",
    "Capacitacion a beneficiarios",
    coordinador.id
  );

  await upsertLocalidad("Comala", "Zacualpan", "28450", coordinador.id);
  await upsertLocalidad("Comala", "Suchitlan", "28459", coordinador.id);
  await upsertLocalidad("Villa de Alvarez", "La Lima", "28979", coordinador.id);

  const beneficiario1 = await crearBeneficiarioDemo({
    tecnicoId: tecnico1.id,
    nombre: "Maria Lopez",
    municipio: "Comala",
    localidad: "Zacualpan",
    telefono: "3120000001",
    cadenaId: cadenaCafe.id,
  });

  await crearBeneficiarioDemo({
    tecnicoId: tecnico1.id,
    nombre: "Jose Hernandez",
    municipio: "Comala",
    localidad: "Suchitlan",
    telefono: "3120000002",
    cadenaId: cadenaMaiz.id,
  });

  await crearBeneficiarioDemo({
    tecnicoId: tecnico2.id,
    nombre: "Ana Garcia",
    municipio: "Villa de Alvarez",
    localidad: "La Lima",
    telefono: "3120000003",
    cadenaId: cadenaCafe.id,
  });

  await sql`
    INSERT INTO asignaciones_actividad (tecnico_id, actividad_id, asignado_por, activo)
    VALUES (${tecnico1.id}, ${actividadVisita.id}, ${coordinador.id}, true)
    ON CONFLICT (tecnico_id, actividad_id) WHERE activo = true
    DO NOTHING
  `;

  await sql`
    INSERT INTO asignaciones_actividad (tecnico_id, actividad_id, asignado_por, activo)
    VALUES (${tecnico1.id}, ${actividadCap.id}, ${coordinador.id}, true)
    ON CONFLICT (tecnico_id, actividad_id) WHERE activo = true
    DO NOTHING
  `;

  await sql`
    INSERT INTO asignaciones_actividad (tecnico_id, actividad_id, asignado_por, activo)
    VALUES (${tecnico2.id}, ${actividadVisita.id}, ${coordinador.id}, true)
    ON CONFLICT (tecnico_id, actividad_id) WHERE activo = true
    DO NOTHING
  `;

  await sql`
    INSERT INTO notificaciones (destino_id, destino_tipo, tipo, titulo, cuerpo)
    VALUES (
      ${tecnico1.id},
      'tecnico',
      'recordatorio',
      'Revision pendiente',
      ${`Tienes seguimiento pendiente para ${beneficiario1.id}`}
    )
  `;

  console.log("Datos de desarrollo listos.");
  console.log(`Tecnico Uno: tecnico1@campo.local / 12345`);
  console.log(`Tecnico Dos: tecnico2@campo.local / 12346`);
  console.log(`Coordinador Demo: coordinador@campo.local / 900001`);
}

seedDev()
  .catch((error) => {
    console.error("No se pudieron sembrar datos de desarrollo:", error);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
