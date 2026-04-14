import { sql } from "../db";

const MIGRATIONS: Record<string, () => Promise<void>> = {
  "001_add_indexes": async () => {
    const indexes = [
      "CREATE INDEX IF NOT EXISTS bitacoras_sync_id_idx ON bitacoras (sync_id) WHERE sync_id IS NOT NULL",
      "CREATE INDEX IF NOT EXISTS bitacoras_estado_fecha_idx ON bitacoras (estado, fecha_inicio DESC)",
      "CREATE INDEX IF NOT EXISTS idx_beneficiarios_municipio ON beneficiarios (municipio)",
      "CREATE INDEX IF NOT EXISTS idx_beneficiarios_sync_id ON beneficiarios (sync_id) WHERE sync_id IS NOT NULL",
      "CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo ON notificaciones (tipo)",
      "CREATE INDEX IF NOT EXISTS idx_usuarios_codigo_acceso ON usuarios (codigo_acceso) WHERE codigo_acceso IS NOT NULL",
      "CREATE INDEX IF NOT EXISTS idx_usuarios_activo_rol ON usuarios (activo, rol)",
      "CREATE INDEX IF NOT EXISTS idx_localidades_municipio ON localidades (municipio)",
    ];

    for (const idx of indexes) {
      await sql.unsafe(idx);
    }
  },
};

async function runMigrations() {
  console.log("[Migrations] Checking migrations table...");
  
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log("[Migrations] Getting applied migrations...");
  const applied = await sql<{ name: string }[]>`SELECT name FROM _migrations`;
  const appliedNames = new Set(applied.map(m => m.name));

  console.log("[Migrations] Applied:", [...appliedNames].join(", ") || "none");

  for (const [name, fn] of Object.entries(MIGRATIONS)) {
    if (appliedNames.has(name)) {
      console.log(`[Migrations] Skipping ${name} (already applied)`);
      continue;
    }

    console.log(`[Migrations] Running ${name}...`);
    try {
      await fn();
      await sql`INSERT INTO _migrations (name) VALUES (${name})`;
      console.log(`[Migrations] Completed ${name}`);
    } catch (error) {
      console.error(`[Migrations] Error in ${name}:`, error);
      throw error;
    }
  }

  console.log("[Migrations] All migrations complete!");
}

runMigrations()
  .catch((error) => {
    console.error("[Migrations] Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
