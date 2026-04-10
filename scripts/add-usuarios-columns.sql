-- Add missing columns to usuarios table
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_limite TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado_corte TEXT NOT NULL DEFAULT 'en_servicio';
