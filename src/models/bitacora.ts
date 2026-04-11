export interface Bitacora {
  id: string;
  tipo: string;
  tecnico_id: string;
  beneficiario_id: string | null;
  cadena_productiva_id: string | null;
  actividad_id: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  coord_inicio: string | null;
  coord_fin: string | null;
  actividades_desc: string;
  recomendaciones: string | null;
  comentarios_beneficiario: string | null;
  coordinacion_interinst: boolean;
  instancia_coordinada: string | null;
  proposito_coordinacion: string | null;
  observaciones_coordinador: string | null;
  foto_rostro_url: string | null;
  firma_url: string | null;
  fotos_campo: string[];
  estado: string;
  pdf_version: number;
  pdf_url_actual: string | null;
  pdf_original_url: string | null;
  creada_offline: boolean;
  sync_id: string | null;
  created_at: string;
  updated_at: string;
  pdf_edicion: Record<string, unknown>;
  beneficiario_nombre?: string;
  actividad_nombre?: string;
  calificacion: number | null;
  reporte: string | null;
  datos_extendidos: Record<string, unknown> | null;
}

export interface BitacoraResumen {
  id: string;
  tipo: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  sync_id: string | null;
}

export interface PdfVersion {
  id: string;
  bitacora_id: string;
  version: number;
  r2_key: string;
  sha256: string;
  inmutable: boolean;
  generado_por: string | null;
  created_at: string;
}

export interface Notificacion {
  id: string;
  destino_id: string;
  destino_tipo: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  leido: boolean;
  enviado_push: boolean;
  enviado_email: boolean;
  created_at: string;
}
