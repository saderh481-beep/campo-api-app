import { sql } from "@/db";
import { redis } from "@/lib/redis";
import { signJwt } from "@/lib/jwt";
import type { UsuarioLogin } from "@/models";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export async function loginTecnico(codigo: string, ip?: string, userAgent?: string) {
  const [tecnico] = await sql<UsuarioLogin[]>`
    SELECT id, nombre, correo, activo, fecha_limite, estado_corte
    FROM usuarios
    WHERE codigo_acceso = ${codigo} AND activo = true
    LIMIT 1
  `;

  if (!tecnico) {
    return { success: false, error: "Código inválido o expirado" };
  }

  /* TODO: [BLACKBOXAI] Desactivado temporalmente fecha global
  const fechaLimiteVencida = tecnico.fecha_limite
    ? new Date(tecnico.fecha_limite).getTime() < Date.now()
    : false;
  const corteAplicado = tecnico.estado_corte && tecnico.estado_corte !== "en_servicio";

  if (fechaLimiteVencida || corteAplicado) {
    return { success: false, error: "periodo_vencido" };
  } */

  const token = await signJwt({ sub: tecnico.id, nombre: tecnico.nombre, rol: "tecnico" });

  await redis.setex(
    `session:${token}`,
    SESSION_TTL_SECONDS,
    JSON.stringify({
      sub: tecnico.id,
      nombre: tecnico.nombre,
      rol: "tecnico",
    })
  );

  // Registrar log de autenticación
  await sql`
    INSERT INTO auth_logs (actor_id, actor_tipo, accion, ip, user_agent)
    VALUES (${tecnico.id}, 'tecnico', 'login', ${ip ?? null}, ${userAgent ?? null})
  `;

  return {
    success: true,
    token,
    tecnico: { id: tecnico.id, nombre: tecnico.nombre },
  };
}

export async function logoutTecnico(token: string, tecnicoId: string) {
  await redis.del(`session:${token}`);

  await sql`
    INSERT INTO auth_logs (actor_id, actor_tipo, accion)
    VALUES (${tecnicoId}, 'tecnico', 'logout')
  `;

  return { success: true };
}
