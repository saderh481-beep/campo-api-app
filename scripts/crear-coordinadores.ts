import { sql } from "../src/db";  
  
// Funcion para generar codigo aleatorio de 6 digitos  
function generarCodigo6Digitos(): string {  
  return Math.floor(100000 + Math.random() * 900000).toString();  
}  
  
// Datos de los 3 coordinadores a crear  
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
  
    try {  
      const [nuevoUsuario] = await sql`  
        INSERT INTO usuarios (nombre, correo, codigo_acceso, activo)  
        VALUES (${coord.nombre}, ${coord.correo}, ${codigo}, true)  
        RETURNING id, nombre, correo, codigo_acceso  
      `;  
  
      console.log(`V Coordinador creado exitosamente:`);  
      console.log(`  ID: ${nuevoUsuario.id}`);  
      console.log(`  Nombre: ${nuevoUsuario.nombre}`);  
      console.log(`  Correo: ${nuevoUsuario.correo}`);  
      console.log(`  Codigo de acceso (6 digitos): ${nuevoUsuario.codigo_acceso}`);  
      console.log("");  
    } catch (error) {  
      console.error(`X Error al crear coordinador ${coord.nombre}:`, error);  
    }  
  }  
  
  console.log("Proceso completado.");  
  process.exit(0);  
}  
  
crearCoordinadores(); 
