import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "@/middleware/auth";
import type { JwtPayload } from "@/lib/jwt";
import { sincronizarOperaciones, obtenerDeltaSync } from "@/services/sync.service";

const app = new Hono<{
  Variables: {
    tecnico: JwtPayload;
  };
}>();

app.use("*", authMiddleware);

const schemaBitacoraTipoA = z.object({
  tipo: z.literal("beneficiario"),
  beneficiario_id: z.string().uuid(),
  cadena_productiva_id: z.string().uuid().optional(),
  fecha_inicio: z.string().datetime().optional(),
  coord_inicio: z.string().optional(),
  sync_id: z.string(),
  actividades_desc: z.string().optional(),
  recomendaciones: z.string().optional(),
  comentarios_beneficiario: z.string().optional(),
  coordinacion_interinst: z.boolean().optional(),
  instancia_coordinada: z.string().optional(),
  proposito_coordinacion: z.string().optional(),
  observaciones_coordinador: z.string().optional(),
  foto_rostro_url: z.string().optional(),
  firma_url: z.string().optional(),
  fotos_campo: z.array(z.string()).optional(),
  calificacion: z.number().optional(),
  reporte: z.string().optional(),
  datos_extendidos: z.any().optional(),
});

const schemaBitacoraTipoB = z.object({
  tipo: z.literal("actividad"),
  actividad_id: z.string().uuid(),
  fecha_inicio: z.string().datetime().optional(),
  coord_inicio: z.string().optional(),
  sync_id: z.string(),
  actividades_desc: z.string().optional(),
  recomendaciones: z.string().optional(),
  comentarios_beneficiario: z.string().optional(),
  coordinacion_interinst: z.boolean().optional(),
  instancia_coordinada: z.string().optional(),
  proposito_coordinacion: z.string().optional(),
  observaciones_coordinador: z.string().optional(),
  foto_rostro_url: z.string().optional(),
  firma_url: z.string().optional(),
  fotos_campo: z.array(z.string()).optional(),
  calificacion: z.number().optional(),
  reporte: z.string().optional(),
  datos_extendidos: z.any().optional(),
});

const schemaCrearBitacoraPayload = z.union([schemaBitacoraTipoA, schemaBitacoraTipoB]);

const schemaCrearBeneficiarioPayload = z.object({
  sync_id: z.string(),
  nombre: z.string().min(1),
  municipio: z.string().min(1),
  localidad: z.string().min(1),
  telefono: z.string().optional(),
  telefono_secundario: z.string().optional(),
  direccion: z.string().optional(),
  cp: z.string().optional(),
  coord_parcela: z.string().optional(),
  cadena_productiva_id: z.string().uuid().optional(),
});

const schemaEditarBitacoraPayload = z.object({
  sync_id: z.string(),
  actividades_desc: z.string().optional(),
  coord_inicio: z.string().optional(),
  coord_fin: z.string().optional(),
  fecha_inicio: z.string().datetime().optional(),
  fecha_fin: z.string().datetime().optional(),
  recomendaciones: z.string().optional(),
  comentarios_beneficiario: z.string().optional(),
  coordinacion_interinst: z.boolean().optional(),
  instancia_coordinada: z.string().optional(),
  proposito_coordinacion: z.string().optional(),
  observaciones_coordinador: z.string().optional(),
  foto_rostro_url: z.string().optional(),
  firma_url: z.string().optional(),
  fotos_campo: z.array(z.string()).optional(),
  calificacion: z.number().optional(),
  reporte: z.string().optional(),
  datos_extendidos: z.any().optional(),
});

const schemaCerrarBitacoraPayload = z.object({
  sync_id: z.string(),
  fecha_fin: z.string().datetime(),
  coord_fin: z.string().optional(),
  actividades_desc: z.string().optional(),
  recomendaciones: z.string().optional(),
  comentarios_beneficiario: z.string().optional(),
  coordinacion_interinst: z.boolean().optional(),
  instancia_coordinada: z.string().optional(),
  proposito_coordinacion: z.string().optional(),
  observaciones_coordinador: z.string().optional(),
  foto_rostro_url: z.string().optional(),
  firma_url: z.string().optional(),
  fotos_campo: z.array(z.string()).optional(),
  calificacion: z.number().optional(),
  reporte: z.string().optional(),
  datos_extendidos: z.any().optional(),
});

const schemaOperacion = z.discriminatedUnion("operacion", [
  z.object({
    operacion: z.literal("crear_beneficiario"),
    timestamp: z.string().datetime(),
    payload: schemaCrearBeneficiarioPayload,
  }),
  z.object({
    operacion: z.literal("crear_bitacora"),
    timestamp: z.string().datetime(),
    payload: schemaCrearBitacoraPayload,
  }),
  z.object({
    operacion: z.literal("editar_bitacora"),
    timestamp: z.string().datetime(),
    payload: schemaEditarBitacoraPayload,
  }),
  z.object({
    operacion: z.literal("cerrar_bitacora"),
    timestamp: z.string().datetime(),
    payload: schemaCerrarBitacoraPayload,
  }),
]);

const schemaSyncRequest = z.object({
  operaciones: z.array(schemaOperacion),
});

app.post(
  "/sync",
  zValidator("json", schemaSyncRequest),
  async (c) => {
    const tecnico = c.get("tecnico");
    const { operaciones } = c.req.valid("json");

    const resultado = await sincronizarOperaciones(tecnico.sub, operaciones);
    return c.json(resultado);
  }
);

app.get("/sync/delta", async (c) => {
  const tecnico = c.get("tecnico");
  const ultimoSync = c.req.query("ultimo_sync");

  if (!ultimoSync) {
    return c.json({
      sync_ts: new Date().toISOString(),
      beneficiarios: [],
      actividades: [],
      cadenas: [],
      localidades: [],
      bitacoras: [],
      asignaciones: { beneficiarios: [], actividades: [] },
      message: "Primera sincronización - no hay datos locales"
    });
  }

  const resultado = await obtenerDeltaSync(tecnico.sub, ultimoSync);

  if ("error" in resultado) {
    return c.json({ 
      error: resultado.error,
      code: "SYNC_ERROR",
      message: "Error al obtener cambios para sincronización"
    }, 400);
  }

  return c.json(resultado);
});

export default app;
