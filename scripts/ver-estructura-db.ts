import { sql } from "../src/db";

async function verEstructuraDB() {
  console.log("=== ESTRUCTURA COMPLETA DE LA BASE DE DATOS ===");
  console.log("");

  const tablas = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  console.log(`Total de tablas: ${tablas.length}`);
  console.log("");

  for (const tabla of tablas as Array<{ table_name: string }>) {
    console.log(`\n=== TABLA: ${tabla.table_name} ===`);

    const columnas = await sql`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tabla.table_name}
      ORDER BY ordinal_position
    `;

    console.log("Columnas:");
    for (const col of columnas as Array<{
      column_name: string;
      data_type: string;
      character_maximum_length: number | null;
      column_default: string | null;
      is_nullable: string;
    }>) {
      const tipo = col.character_maximum_length
        ? `${col.data_type}(${col.character_maximum_length})`
        : col.data_type;
      const nullable = col.is_nullable === "YES" ? "NULL" : "NOT NULL";
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : "";
      console.log(`  - ${col.column_name}: ${tipo} ${nullable}${defaultVal}`);
    }

    const restricciones = await sql`
      SELECT
        constraint_name,
        constraint_type
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = ${tabla.table_name}
      ORDER BY constraint_name
    `;

    if (restricciones.length > 0) {
      console.log("Restricciones:");
      for (const rest of restricciones as Array<{ constraint_name: string; constraint_type: string }>) {
        console.log(`  - ${rest.constraint_name}: ${rest.constraint_type}`);
      }
    }
  }

  console.log("\n=== FIN DE LA ESTRUCTURA ===");
}

verEstructuraDB()
  .catch((error) => {
    console.error("No se pudo inspeccionar la base de datos:", error);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
