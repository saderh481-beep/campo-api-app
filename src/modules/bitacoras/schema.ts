import { z } from "zod";

const gpsSchema = z.object({
  lat:      z.number().min(-90).max(90),
  lng:      z.number().min(-180).max(180),
  precision: z.number().optional(),
});

export const crearBitacoraSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo:               z.literal("A"),
    beneficiarioId:     z.string().uuid(),
    cadenaProductivaId: z.string().uuid(),
    gpsInicio:          gpsSchema,
    notas:              z.string().max(2000).optional(),
  }),
  z.object({
    tipo:        z.literal("B"),
    actividadId: z.string().uuid(),
    gpsInicio:   gpsSchema,
    notas:       z.string().max(2000).optional(),
  }),
]);

export const actualizarBitacoraSchema = z.object({
  notas: z.string().max(2000).nullable().optional(),
});

export const cerrarBitacoraSchema = z.object({
  gpsFin: gpsSchema,
});

export const listarBitacorasSchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  estado:   z.enum(["borrador", "cerrada"]).optional(),
  mes:      z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
