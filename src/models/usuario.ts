export interface Usuario {
  id: string;
  correo: string;
  nombre: string;
  rol: string;
  activo: boolean;
  codigo_acceso: string | null;
  hash_codigo_acceso: string | null;
  telefono: string | null;
  fecha_limite: string | null;
  estado_corte: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsuarioLogin {
  id: string;
  nombre: string;
  correo: string;
  activo: boolean;
  fecha_limite: string | null;
  estado_corte: string | null;
}
