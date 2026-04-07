import { sql } from "../src/db";

const schemaSql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'tecnico',
  activo BOOLEAN NOT NULL DEFAULT true,
  codigo_acceso TEXT,
  hash_codigo_acceso TEXT,
  telefono TEXT,
  fecha_limite TIMESTAMPTZ,
  estado_corte TEXT NOT NULL DEFAULT 'en_servicio',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  actor_tipo TEXT NOT NULL,
  accion TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cadenas_productivas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS localidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio TEXT NOT NULL,
  nombre TEXT NOT NULL,
  cp TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  zona_id UUID,
  UNIQUE (municipio, nombre)
);

CREATE TABLE IF NOT EXISTS beneficiarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  municipio TEXT NOT NULL,
  localidad TEXT,
  direccion TEXT,
  cp TEXT,
  telefono_principal TEXT,
  telefono_secundario TEXT,
  coord_parcela TEXT[],
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  localidad_id UUID REFERENCES localidades(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS beneficiario_cadenas (
  beneficiario_id UUID NOT NULL REFERENCES beneficiarios(id) ON DELETE CASCADE,
  cadena_id UUID NOT NULL REFERENCES cadenas_productivas(id) ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT true,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (beneficiario_id, cadena_id)
);

CREATE TABLE IF NOT EXISTS asignaciones_beneficiario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  beneficiario_id UUID NOT NULL REFERENCES beneficiarios(id) ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT true,
  asignado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removido_en TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS asignaciones_beneficiario_unica_activa
  ON asignaciones_beneficiario (tecnico_id, beneficiario_id)
  WHERE activo = true;

CREATE TABLE IF NOT EXISTS asignaciones_actividad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  actividad_id UUID NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT true,
  asignado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removido_en TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS asignaciones_actividad_unica_activa
  ON asignaciones_actividad (tecnico_id, actividad_id)
  WHERE activo = true;

CREATE TABLE IF NOT EXISTS bitacoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('beneficiario', 'actividad')),
  tecnico_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  beneficiario_id UUID REFERENCES beneficiarios(id) ON DELETE SET NULL,
  cadena_productiva_id UUID REFERENCES cadenas_productivas(id) ON DELETE SET NULL,
  actividad_id UUID REFERENCES actividades(id) ON DELETE SET NULL,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ,
  coord_inicio TEXT,
  coord_fin TEXT,
  actividades_desc TEXT NOT NULL DEFAULT '',
  recomendaciones TEXT,
  comentarios_beneficiario TEXT,
  coordinacion_interinst BOOLEAN NOT NULL DEFAULT false,
  instancia_coordinada TEXT,
  proposito_coordinacion TEXT,
  observaciones_coordinador TEXT,
  foto_rostro_url TEXT,
  firma_url TEXT,
  fotos_campo JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado TEXT NOT NULL DEFAULT 'borrador',
  pdf_version INTEGER NOT NULL DEFAULT 0,
  pdf_url_actual TEXT,
  pdf_original_url TEXT,
  creada_offline BOOLEAN NOT NULL DEFAULT false,
  sync_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pdf_edicion JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS bitacoras_tecnico_fecha_idx
  ON bitacoras (tecnico_id, fecha_inicio DESC);

CREATE TABLE IF NOT EXISTS pdf_versiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bitacora_id UUID NOT NULL REFERENCES bitacoras(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  inmutable BOOLEAN NOT NULL DEFAULT false,
  generado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bitacora_id, version)
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destino_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  destino_tipo TEXT NOT NULL DEFAULT 'tecnico',
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  leido BOOLEAN NOT NULL DEFAULT false,
  enviado_push BOOLEAN NOT NULL DEFAULT false,
  enviado_email BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notificaciones_destino_idx
  ON notificaciones (destino_id, leido, created_at DESC);
`;

async function initDb() {
  await sql.unsafe(schemaSql);
  console.log("Esquema base creado o validado correctamente.");
}

initDb()
  .catch((error) => {
    console.error("No se pudo inicializar la base de datos:", error);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
