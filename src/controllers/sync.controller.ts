// @ts-nocheck
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "@/middleware/auth";
import type { JwtPayload } from "@/lib/jwt";
import { sql } from "@/db";
import { sincronizarOperaciones, obtenerDeltaSync, obtenerBitacorasPendientesSync, sincronizarBitacorasOffline } from "@/services/sync.service";

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

    console.log("[sync] tecnico:", tecnico.sub, "operaciones:", operaciones?.length);
    
    const resultado = await sincronizarOperaciones(tecnico.sub, operaciones);
    return c.json(resultado);
  }
);

app.get("/sync/delta", async (c) => {
  const tecnico = c.get("tecnico");
  const ultimoSync = c.req.query("ultimo_sync");

  console.log("[sync/delta] tecnico:", tecnico.sub, "ultimoSync:", ultimoSync);
  
  const resultado = await obtenerDeltaSync(tecnico.sub, ultimoSync);

  if ("error" in resultado) {
    return c.json({ 
      error: resultado.error,
      code: "SYNC_ERROR",
      message: "Error al obtener cambios para sincronización"
    }, 400);
  }

  console.log("[sync/delta] Resultado - beneficiarios:", resultado.beneficiarios?.length, "bitacoras:", resultado.bitacoras?.length, "asignaciones:", resultado.asignaciones?.beneficiarios?.length);
  
  return c.json(resultado);
});

app.get("/sync/debug", async (c) => {
  const tecnico = c.get("tecnico");
  
  const [bitacorasCount] = await sql.unsafe(`SELECT COUNT(*)::int as total FROM bitacoras WHERE tecnico_id = $1`, [tecnico.sub]);
  const [asignacionesBenCount] = await sql.unsafe(`SELECT COUNT(*)::int as total FROM asignaciones_beneficiario WHERE tecnico_id = $1 AND activo = true`, [tecnico.sub]);
  const [asignacionesActCount] = await sql.unsafe(`SELECT COUNT(*)::int as total FROM asignaciones_actividad WHERE tecnico_id = $1 AND activo = true`, [tecnico.sub]);
  
  return c.json({
    tecnico_id: tecnico.sub,
    bitacoras_total: bitacorasCount?.total ?? 0,
    asignaciones_beneficiarios: asignacionesBenCount?.total ?? 0,
    asignaciones_actividades: asignacionesActCount?.total ?? 0,
  });
});

app.post("/sync/sincronizar-offline", async (c) => {
  const tecnico = c.get("tecnico");
  const body = await c.req.json<{ sync_ids: string[] }>();
  
  if (!body.sync_ids || !Array.isArray(body.sync_ids)) {
    return c.json({ error: "sync_ids requerido" }, 400);
  }
  
  const resultado = await sincronizarBitacorasOffline(tecnico.sub, body.sync_ids);
  return c.json(resultado);
});

export default app;
