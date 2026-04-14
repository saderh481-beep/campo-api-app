import { sql } from "../db";

const migrationsTableSql = `
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const createIndexesSql = `
-- Índices adicionales para mejorar rendimiento

-- bitacoras: búsqueda por sync_id (offline sync)
CREATE INDEX IF NOT EXISTS bitacoras_sync_id_idx ON bitacoras (sync_id) WHERE sync_id IS NOT NULL;

-- bitacoras: búsqueda por estado y fecha
CREATE INDEX IF NOT EXISTS bitacoras_estado_fecha_idx ON bitacoras (estado, fecha_inicio DESC);

-- beneficiarios: búsqueda por municipio
CREATE INDEX IF NOT EXISTS idx_beneficiarios_municipio ON beneficiarios (municipio);

-- beneficiarios: búsqueda por sync_id
CREATE INDEX IF NOT EXISTS idx_beneficiarios_sync_id ON beneficiarios (sync_id) WHERE sync_id IS NOT NULL;

-- notificaciones: búsqueda por tipo
CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo ON notificaciones (tipo);

-- usuarios: búsqueda por código de acceso
CREATE INDEX IF NOT EXISTS idx_usuarios_codigo_acceso ON usuarios (codigo_acceso) WHERE codigo_acceso IS NOT NULL;

-- usuarios: búsqueda por estado y rol
CREATE INDEX IF NOT EXISTS idx_usuarios_activo_rol ON usuarios (activo, rol);

-- localidades: búsqueda por municipio
CREATE INDEX IF NOT EXISTS idx_localidades_municipio ON localidades (municipio);
`;

async function runMigrations() {
  console.log("[Migrations] Creating migrations table if not exists...");
  await sql.unsafe(migrationsTableSql);
  
  console.log("[Migrations] Checking applied migrations...");
  const [migration] = await sql`SELECT name FROM _migrations WHERE name = '001_add_indexes' LIMIT 1`;
  
  if (migration) {
    console.log("[Migrations] Migration '001_add_indexes' already applied, skipping.");
    return;
  }
  
  console.log("[Migrations] Running indexes migration...");
  await sql.unsafe(createIndexesSql);
  
  console.log("[Migrations] Recording migration...");
  await sql`INSERT INTO _migrations (name) VALUES ('001_add_indexes')`;
  
  console.log("[Migrations] Completed successfully!");
}

runMigrations()
  .catch((error) => {
    console.error("[Migrations] Error running migrations:", error);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
