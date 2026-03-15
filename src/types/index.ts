export interface JWTPayloadApp {
  sub: string;   // tecnico id
  tipo: "tecnico";
  iat: number;
  exp: number;
}

declare module "hono" {
  interface ContextVariableMap {
    jwtPayload: JWTPayloadApp;
  }
}

export type TipoBitacora  = "A" | "B";
export type EstadoBitacora = "borrador" | "cerrada";

export interface GPS {
  lat: number;
  lng: number;
  precision?: number; // metros
}

export interface BitacoraApp {
  id: string;
  tecnicoId: string;
  tipo: TipoBitacora;
  estado: EstadoBitacora;
  beneficiarioId: string | null;
  cadenaProductivaId: string | null;
  actividadId: string | null;
  fechaInicio: Date;
  fechaFin: Date | null;
  gpsInicio: GPS | null;
  gpsFin: GPS | null;
  notas: string | null;
  creadoEn: Date;
}
