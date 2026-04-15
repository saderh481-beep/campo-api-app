// @ts-nocheck
import { sql } from "@/db";
import { redis } from "@/lib/redis";
import { signJwt } from "@/lib/jwt";
import type { UsuarioLogin } from "@/models";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function normalizarCodigo(codigo: string) {
  return codigo.trim();
}

function rolEsTecnico(rol: string | null | undefined) {
  return (rol ?? "").trim().toLowerCase() === "tecnico";
}

function tieneCorteActivo(estadoCorte: string | null | undefined) {
  const estado = (estadoCorte ?? "").trim().toLowerCase();
  return estado !== "" && estado !== "en_servicio" && estado !== "activo";
}

async function codigoCoincideConHash(codigo: string, hash: string | null) {
  if (!hash) return false;

  try {
    return await Bun.password.verify(codigo, hash);
  } catch {
    return false;
  }
}

async function obtenerTecnicosPorCodigo(codigoNormalizado: string) {
  try {
    return await sql<UsuarioLogin[]>`
      SELECT id, nombre, correo, rol, activo, codigo_acceso, hash_codigo_acceso, fecha_limite, estado_corte
      FROM usuarios
      WHERE activo = true
        AND LOWER(COALESCE(rol, '')) = 'tecnico'
        AND (
          codigo_acceso = ${codigoNormalizado}
          OR hash_codigo_acceso IS NOT NULL
        )
      ORDER BY updated_at DESC, created_at DESC
    `;
  } catch (error) {
    if ((error as { code?: string })?.code !== "42703") {
      throw error;
    }
  }

  try {
    return await sql<UsuarioLogin[]>`
      SELECT id, nombre, correo, rol, codigo_acceso, hash_codigo_acceso, fecha_limite, estado_corte
      FROM usuarios
      WHERE LOWER(COALESCE(rol, '')) = 'tecnico'
        AND (
          codigo_acceso = ${codigoNormalizado}
          OR hash_codigo_acceso IS NOT NULL
        )
      ORDER BY updated_at DESC, created_at DESC
    `;
  } catch (error) {
    if ((error as { code?: string })?.code !== "42703") {
      throw error;
    }
  }

  try {
    return await sql<UsuarioLogin[]>`
      SELECT id, nombre, correo, rol, codigo_acceso, hash_codigo_acceso, estado_corte
      FROM usuarios
      WHERE LOWER(COALESCE(rol, '')) = 'tecnico'
        AND (
          codigo_acceso = ${codigoNormalizado}
          OR hash_codigo_acceso IS NOT NULL
        )
      ORDER BY updated_at DESC, created_at DESC
    `;
  } catch (error) {
    if ((error as { code?: string })?.code !== "42703") {
      throw error;
    }
  }

  try {
    return await sql<UsuarioLogin[]>`
      SELECT id, nombre, correo, rol, codigo_acceso, hash_codigo_acceso
      FROM usuarios
      WHERE LOWER(COALESCE(rol, '')) = 'tecnico'
        AND (
          codigo_acceso = ${codigoNormalizado}
          OR hash_codigo_acceso IS NOT NULL
        )
      ORDER BY updated_at DESC, created_at DESC
    `;
  } catch (error) {
    if ((error as { code?: string })?.code !== "42703") {
      throw error;
    }
  }

  try {
    return await sql<UsuarioLogin[]>`
      SELECT id, nombre, correo, rol, activo, codigo_acceso, hash_codigo_acceso, fecha_limite, estado_corte
      FROM usuarios
      WHERE activo = true
        AND LOWER(COALESCE(rol, '')) = 'tecnico'
        AND (
          codigo_acceso = ${codigoNormalizado}
          OR hash_codigo_acceso IS NOT NULL
        )
    `;
  } catch (error) {
    if ((error as { code?: string })?.code !== "42703") {
      throw error;
    }
  }

  try {
    return await sql<UsuarioLogin[]>`
      SELECT id, nombre, correo, rol, codigo_acceso, hash_codigo_acceso, fecha_limite, estado_corte
      FROM usuarios
      WHERE LOWER(COALESCE(rol, '')) = 'tecnico'
        AND (
          codigo_acceso = ${codigoNormalizado}
          OR hash_codigo_acceso IS NOT NULL
        )
    `;
  } catch (error) {
    if ((error as { code?: string })?.code !== "42703") {
      throw error;
    }
  }

  try {
    return await sql<UsuarioLogin[]>`
      SELECT id, nombre, correo, rol, codigo_acceso, hash_codigo_acceso, estado_corte
      FROM usuarios
      WHERE LOWER(COALESCE(rol, '')) = 'tecnico'
        AND (
          codigo_acceso = ${codigoNormalizado}
          OR hash_codigo_acceso IS NOT NULL
        )
    `;
  } catch (error) {
    if ((error as { code?: string })?.code !== "42703") {
      throw error;
    }
  }

  return await sql<UsuarioLogin[]>`
    SELECT id, nombre, correo, rol, codigo_acceso, hash_codigo_acceso
    FROM usuarios
    WHERE LOWER(COALESCE(rol, '')) = 'tecnico'
      AND (
        codigo_acceso = ${codigoNormalizado}
        OR hash_codigo_acceso IS NOT NULL
      )
  `;
}

async function registrarAuthLog(
  tecnicoId: string,
  accion: "login" | "logout",
  ip?: string | null,
  userAgent?: string | null
) {
  try {
    await sql`
      INSERT INTO auth_logs (actor_id, actor_tipo, accion, ip, user_agent)
      VALUES (${tecnicoId}, 'tecnico', ${accion}, ${ip ?? null}, ${userAgent ?? null})
    `;
    return;
  } catch (error) {
    if ((error as { code?: string })?.code !== "42703") {
      console.error("[auth] No se pudo registrar auth_log completo:", error);
      return;
    }
  }

  try {
    await sql`
      INSERT INTO auth_logs (actor_id, actor_tipo, accion)
      VALUES (${tecnicoId}, 'tecnico', ${accion})
    `;
  } catch (error) {
    console.error("[auth] No se pudo registrar auth_log:", error);
  }
}

export async function loginTecnico(codigo: string, ip?: string, userAgent?: string) {
  const codigoNormalizado = normalizarCodigo(codigo);

  const tecnicos = await obtenerTecnicosPorCodigo(codigoNormalizado);

  let tecnico =
    tecnicos.find((usuario) => usuario.codigo_acceso === codigoNormalizado && rolEsTecnico(usuario.rol)) ??
    null;

  if (!tecnico) {
    for (const candidato of tecnicos) {
      if (!rolEsTecnico(candidato.rol)) continue;
      if (await codigoCoincideConHash(codigoNormalizado, candidato.hash_codigo_acceso)) {
        tecnico = candidato;
        break;
      }
    }
  }

  if (!tecnico) {
    return { success: false, error: "Código inválido o expirado" };
  }

  const fechaLimiteVencida = tecnico.fecha_limite
    ? new Date(tecnico.fecha_limite).getTime() < Date.now()
    : false;
  const corteAplicado = tieneCorteActivo(tecnico.estado_corte);

  if (fechaLimiteVencida || corteAplicado) {
    return { success: false, error: "periodo_vencido" };
  }

  const token = await signJwt({ sub: tecnico.id, nombre: tecnico.nombre, rol: "tecnico" });

  try {
    await redis.setex(
      `session:${token}`,
      SESSION_TTL_SECONDS,
      JSON.stringify({
        sub: tecnico.id,
        nombre: tecnico.nombre,
        rol: "tecnico",
      })
    );
  } catch (error) {
    console.error("[auth] No se pudo guardar la sesión en Redis:", error);
  }

  await registrarAuthLog(tecnico.id, "login", ip ?? null, userAgent ?? null);

  return {
    success: true,
    token,
    tecnico: { id: tecnico.id, nombre: tecnico.nombre, rol: "tecnico" },
  };
}

export async function logoutTecnico(token: string, tecnicoId: string) {
  try {
    await redis.del(`session:${token}`);
  } catch (error) {
    console.error("[auth] No se pudo eliminar la sesión en Redis:", error);
  }

  await registrarAuthLog(tecnicoId, "logout");

  return { success: true };
}
