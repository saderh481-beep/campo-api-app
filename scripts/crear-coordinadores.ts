import { sql } from "../src/db";

function generarCodigo6Digitos() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const coordinadores = [
  { nombre: "Coordinador 1", correo: "coordinador1@ejemplo.com" },
  { nombre: "Coordinador 2", correo: "coordinador2@ejemplo.com" },
  { nombre: "Coordinador 3", correo: "coordinador3@ejemplo.com" },
];

async function crearCoordinadores() {
  console.log("Creando 3 usuarios coordinadores...");
  console.log("");

  for (const coord of coordinadores) {
    const codigo = generarCodigo6Digitos();
    const hash = await Bun.password.hash(codigo);

    try {
      const [nuevoUsuario] = await sql`
        INSERT INTO usuarios (nombre, correo, rol, codigo_acceso, hash_codigo_acceso, activo)
        VALUES (${coord.nombre}, ${coord.correo}, 'coordinador', ${codigo}, ${hash}, true)
        ON CONFLICT (correo) DO UPDATE
        SET nombre = EXCLUDED.nombre,
            rol = EXCLUDED.rol,
            codigo_acceso = EXCLUDED.codigo_acceso,
            hash_codigo_acceso = EXCLUDED.hash_codigo_acceso,
            activo = true,
            updated_at = NOW()
        RETURNING id, nombre, correo, codigo_acceso
      `;

      console.log("Coordinador creado o actualizado:");
      console.log(`  ID: ${nuevoUsuario.id}`);
      console.log(`  Nombre: ${nuevoUsuario.nombre}`);
      console.log(`  Correo: ${nuevoUsuario.correo}`);
      console.log(`  Codigo de acceso: ${nuevoUsuario.codigo_acceso}`);
      console.log("");
    } catch (error) {
      console.error(`Error al crear coordinador ${coord.nombre}:`, error);
    }
  }

  console.log("Proceso completado.");
}

crearCoordinadores()
  .catch((error) => {
    console.error("No se pudieron crear coordinadores:", error);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
