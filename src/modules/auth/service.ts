import { sql } from "@/config/db";
import { redis } from "@/config/db";
import { signToken } from "@/lib/jwt";
import { UnauthorizedError, AppError } from "@/lib/errors";

export async function login(codigo: string, ip: string, userAgent: string) {
  // Buscar técnico activo con ese código
  const [tecnico] = await sql`
    SELECT id, nombre, coordinador_id, fecha_limite, activo
    FROM tecnicos
    WHERE codigo_acceso = ${codigo} AND activo = TRUE
    LIMIT 1
  `;

  if (!tecnico) throw new UnauthorizedError("Código inválido");

  // Verificar expiración de fecha_limite
  if (new Date(tecnico.fechaLimite) < new Date()) {
    throw new AppError("Código expirado. Solicita uno nuevo a tu coordinador", 401);
  }

  // Verificar que el código sigue vigente en Redis (no fue revocado)
  const redisKey   = `tecnico:codigo:${tecnico.id}`;
  const codigoRedis = await redis.get(redisKey);

  if (!codigoRedis || codigoRedis !== codigo) {
    throw new AppError("Código revocado. Solicita uno nuevo a tu coordinador", 401);
  }

  // Registrar acceso
  await sql`
    INSERT INTO auth_logs (tecnico_id, tipo, ip, user_agent)
    VALUES (${tecnico.id}, 'login_app', ${ip}, ${userAgent})
  `;

  const token = await signToken({ sub: tecnico.id, tipo: "tecnico" });

  return {
    token,
    tecnico: {
      id:            tecnico.id,
      nombre:        tecnico.nombre,
      coordinadorId: tecnico.coordinadorId,
      fechaLimite:   tecnico.fechaLimite,
    },
  };
}

export async function me(tecnicoId: string) {
  const [tecnico] = await sql`
    SELECT id, nombre, coordinador_id, fecha_limite
    FROM tecnicos WHERE id = ${tecnicoId} AND activo = TRUE
  `;
  return tecnico ?? null;
}
