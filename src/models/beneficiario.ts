export interface Beneficiario {
  id: string;
  tecnico_id: string;
  nombre: string;
  curp: string | null;
  folio_saderh: string | null;
  municipio: string;
  localidad: string | null;
  direccion: string | null;
  cp: string | null;
  telefono_principal: string | null;
  telefono_secundario: string | null;
  coord_parcela: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  localidad_id: string | null;
  sync_id: string | null;
}

export interface BeneficiarioConCadenas extends Beneficiario {
  cadenas: CadenaProductiva[];
}

export interface CadenaProductiva {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Actividad {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Localidad {
  id: string;
  municipio: string;
  nombre: string;
  cp: string | null;
  activo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  zona_id: string | null;
}
