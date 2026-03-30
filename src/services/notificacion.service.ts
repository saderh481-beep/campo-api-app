import { sql } from "@/db";
import type { Notificacion } from "@/models";

export async function obtenerNotificacionesTecnico(tecnicoId: string) {
  const notificaciones = await sql<Notificacion[]>`
    SELECT id, destino_id, destino_tipo, tipo, titulo, cuerpo, leido, enviado_push, enviado_email, created_at
    FROM notificaciones
    WHERE destino_id = ${tecnicoId} AND leido = false
    ORDER BY created_at DESC
  `;
  return notificaciones;
}

export async function marcarNotificacionLeida(tecnicoId: string, notificacionId: string) {
  await sql`
    UPDATE notificaciones SET leido = true
    WHERE id = ${notificacionId} AND destino_id = ${tecnicoId}
  `;
  return { message: "Marcada como leída" };
}
