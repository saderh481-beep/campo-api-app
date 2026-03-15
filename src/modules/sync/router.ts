import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "@/middleware/auth";
import { sql } from "@/config/db";
import { AppError } from "@/lib/errors";

const router = new Hono();
router.use("*", requireAuth);

// Operación en la cola offline
const operacionSchema = z.object({
  clientId:  z.string(),           // UUID local del registro
  tabla:     z.enum(["bitacoras"]),
  operacion: z.enum(["create", "update", "close"]),
  payload:   z.record(z.unknown()),
  timestamp: z.string().datetime(),
});

const syncSchema = z.object({
  operaciones: z.array(operacionSchema).max(200),
});

// POST /sync — procesa cola offline (FIFO)
router.post("/", zValidator("json", syncSchema), async (c) => {
  const { operaciones } = c.req.valid("json");
  const tecnicoId       = c.get("jwtPayload").sub;
  const resultados: { clientId: string; ok: boolean; error?: string; serverId?: string }[] = [];

  for (const op of operaciones) {
    try {
      if (op.tabla === "bitacoras") {
        if (op.operacion === "create") {
          const d = op.payload as any;
          // Verificar duplicado usando clientId como idempotency key
          const [existe] = await sql`
            SELECT id FROM bitacoras WHERE client_id = ${op.clientId} LIMIT 1
          `;
          if (existe) {
            resultados.push({ clientId: op.clientId, ok: true, serverId: existe.id });
            continue;
          }

          const [nueva] = await sql`
            INSERT INTO bitacoras (
              client_id, tecnico_id, tipo,
              beneficiario_id, cadena_productiva_id, actividad_id,
              gps_inicio, notas, fecha_inicio
            ) VALUES (
              ${op.clientId}, ${tecnicoId}, ${d.tipo},
              ${d.beneficiarioId ?? null}, ${d.cadenaProductivaId ?? null},
              ${d.actividadId    ?? null},
              ${JSON.stringify(d.gpsInicio)},
              ${d.notas ?? null},
              ${op.timestamp}
            ) RETURNING id
          `;
          resultados.push({ clientId: op.clientId, ok: true, serverId: nueva.id });

        } else if (op.operacion === "update") {
          const d = op.payload as any;
          await sql`
            UPDATE bitacoras SET notas = ${d.notas ?? null}
            WHERE (id = ${op.clientId} OR client_id = ${op.clientId})
              AND tecnico_id = ${tecnicoId} AND estado = 'borrador'
          `;
          resultados.push({ clientId: op.clientId, ok: true });

        } else if (op.operacion === "close") {
          const d = op.payload as any;
          await sql`
            UPDATE bitacoras SET
              estado    = 'cerrada',
              fecha_fin = ${op.timestamp},
              gps_fin   = ${JSON.stringify(d.gpsFin)}
            WHERE (id = ${op.clientId} OR client_id = ${op.clientId})
              AND tecnico_id = ${tecnicoId} AND estado = 'borrador'
          `;
          resultados.push({ clientId: op.clientId, ok: true });
        }
      }
    } catch (err) {
      resultados.push({
        clientId: op.clientId,
        ok:    false,
        error: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  }

  return c.json({ resultados });
});

// GET /sync/delta?desde=2026-03-10T00:00:00Z — cambios desde timestamp
router.get("/delta", zValidator("query", z.object({
  desde: z.string().datetime("Formato ISO 8601 requerido"),
})), async (c) => {
  const tecnicoId = c.get("jwtPayload").sub;
  const { desde } = c.req.valid("query");

  const bitacoras = await sql`
    SELECT id, client_id, tipo, estado, beneficiario_id, cadena_productiva_id,
           actividad_id, fecha_inicio, fecha_fin, gps_inicio, gps_fin,
           notas, creado_en, updated_at
    FROM bitacoras
    WHERE tecnico_id = ${tecnicoId}
      AND updated_at > ${desde}
    ORDER BY updated_at ASC
    LIMIT 500
  `;

  const cadenas = await sql`
    SELECT id, nombre, activo FROM cadenas_productivas
    WHERE updated_at > ${desde} AND activo = TRUE
    ORDER BY nombre ASC
  `;

  const actividades = await sql`
    SELECT id, nombre, activo FROM actividades
    WHERE updated_at > ${desde} AND activo = TRUE
    ORDER BY nombre ASC
  `;

  return c.json({
    serverTimestamp: new Date().toISOString(),
    bitacoras,
    cadenas,
    actividades,
  });
});

export default router;
