export interface AsignacionBeneficiario {
  id: string;
  tecnico_id: string;
  beneficiario_id: string;
  activo: boolean;
  asignado_por: string;
  asignado_en: string;
  removido_en: string | null;
}

export interface AsignacionActividad {
  id: string;
  tecnico_id: string;
  actividad_id: string;
  activo: boolean;
  asignado_por: string;
  asignado_en: string;
  removido_en: string | null;
}

export interface BeneficiarioCadena {
  beneficiario_id: string;
  cadena_id: string;
  activo: boolean;
  asignado_en: string;
}

export interface TecnicoDetalle {
  id: string;
  tecnico_id: string;
  coordinador_id: string;
  fecha_limite: string | null;
  estado_corte: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AsignacionBeneficiarioDetalle extends AsignacionBeneficiario {
  beneficiario_nombre: string;
  municipio: string;
  localidad: string | null;
}

export interface AsignacionActividadDetalle extends AsignacionActividad {
  actividad_nombre: string;
  actividad_descripcion: string | null;
}
