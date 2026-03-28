import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sql } from "@/db";
import { authMiddleware } from "@/middleware/auth";
import type { JwtPayload } from "@/lib/jwt";

const app = new Hono<{
  Variables: {
    tecnico: JwtPayload
  }
}>();
app.use("*", authMiddleware);

const schemaBitacoraTipoA = z.object({
  tipo: z.literal("beneficiario"),
  beneficiario_id: z.string().uuid(),
  cadena_productiva_id: z.string().uuid().optional(),
  fecha_inicio: z.string().datetime(),
  coord_inicio: z.string().optional(),
  sync_id: z.string(),
});

const schemaBitacoraTipoB = z.object({
  tipo: z.literal("actividad"),
  actividad_id: z.string().uuid(),
  fecha_inicio: z.string().datetime(),
  coord_inicio: z.string().optional(),
  sync_id: z.string(),
});

const schemaOperacion = z.object({
  operacion: z.enum(["crear_bitacora", "cerrar_bitacora", "editar_bitacora"]),
  timestamp: z.string().datetime(),
  payload: z.union([schemaBitacoraTipoA, schemaBitacoraTipoB]),
});

app.post(
  "/sync",
  zValidator("json", z.object({ operaciones: z.array(schemaOperacion) })),
  async (c) => {
    const tecnico = c.get("tecnico");
    const { operaciones } = c.req.valid("json");

    const ordenadas = [...operaciones].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const resultados: { sync_id?: string; operacion: string; exito: boolean; error?: string }[] = [];

    for (const op of ordenadas) {
      try {
        if (op.operacion === "crear_bitacora") {
          const p = op.payload as Record<string, unknown>;

          if (!p.sync_id) throw new Error("sync_id requerido");
          const [existente] = await sql`SELECT id FROM bitacoras WHERE sync_id = ${String(p.sync_id)}`;
          if (existente) {
            resultados.push({ sync_id: String(p.sync_id), operacion: op.operacion, exito: true });
            continue;
          }

          await sql`
            INSERT INTO bitacoras (
              tecnico_id, tipo, estado, fecha_inicio, coord_inicio, sync_id,
              beneficiario_id, cadena_productiva_id, actividad_id
            ) VALUES (
              ${tecnico.sub}, ${String(p.tipo)}, 'borrador', ${String(p.fecha_inicio)},
              ${(p.coord_inicio as string | null) ?? null},
              ${String(p.sync_id)},
              ${(p.beneficiario_id as string | null) ?? null},
              ${(p.cadena_productiva_id as string | null) ?? null},
              ${(p.actividad_id as string | null) ?? null}
            )
          `;
          resultados.push({ sync_id: String(p.sync_id), operacion: op.operacion, exito: true });
        } else {
          resultados.push({ operacion: op.operacion, exito: false, error: "Operación no implementada en sync" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        resultados.push({ operacion: op.operacion, exito: false, error: msg });
      }
    }

    return c.json({ procesadas: resultados.length, resultados });
  }
);

app.get("/sync/delta", async (c) => {
  const tecnico = c.get("tecnico");
  const { ultimo_sync } = c.req.query();
  const desde = ultimo_sync ? new Date(ultimo_sync) : new Date(0);
  if (isNaN(desde.getTime())) {
    return c.json({ error: "Formato de fecha inválido. Usa ISO 8601, ej: 2026-03-01T00:00:00Z" }, 400);
  }

  const [beneficiarios, actividades, cadenas] = await Promise.all([
    sql`
      SELECT DISTINCT b.id, b.nombre, b.municipio, b.localidad, b.updated_at
      FROM beneficiarios b
      JOIN asignaciones_beneficiario ab ON ab.beneficiario_id = b.id
      WHERE ab.tecnico_id = ${tecnico.sub}
        AND ab.activo = true
        AND b.updated_at > ${desde.toISOString()}
    `,
    sql`
      SELECT a.id, a.nombre, a.descripcion, a.updated_at
      FROM actividades a
      JOIN asignaciones_actividad aa ON aa.actividad_id = a.id
      WHERE aa.tecnico_id = ${tecnico.sub}
        AND aa.activo = true
        AND a.updated_at > ${desde.toISOString()}
    `,
    sql`
      SELECT id, nombre, descripcion, updated_at
      FROM cadenas_productivas
      WHERE activo = true AND updated_at > ${desde.toISOString()}
    `,
  ]);

  return c.json({
    sync_ts: new Date().toISOString(),
    beneficiarios,
    actividades,
    cadenas,
  });
});

export default app;
