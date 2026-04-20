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
    const { globalThis } = await import("global");
    const Bun = (globalThis as any).Bun;
    if (Bun?.password?.verify) {
      return await Bun.password.verify(codigo, hash);
    }
    return codigo === hash;
  } catch {
    return false;
  }
}

async function obtenerTecnicosPorCodigo(codigoNormalizado: string) {
  console.log("[auth] Buscando tecnico con codigo:", codigoNormalizado);
  
  const tecnicos = await sql<UsuarioLogin[]>`
    SELECT id, nombre, correo, rol, activo, codigo_acceso, hash_codigo_acceso, fecha_limite, estado_corte
    FROM usuarios
    WHERE LOWER(rol) = 'tecnico'
      AND (
        codigo_acceso = ${codigoNormalizado}
        OR hash_codigo_acceso IS NOT NULL
      )
    LIMIT 10
  `;
  
  console.log("[auth] Tecnicos encontrados:", tecnicos?.length ?? 0);
  return tecnicos ?? [];
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
  console.log("[login] Intentando login con codigo:", codigoNormalizado);

  const tecnicos = await obtenerTecnicosPorCodigo(codigoNormalizado);

  let tecnico = null;
  
  for (const candidato of tecnicos) {
    console.log("[login] Verificando candidato:", candidato.id, "rol:", candidato.rol, "hasCode:", !!candidato.codigo_acceso, "hasHash:", !!candidato.hash_codigo_acceso);
    
    if (candidato.codigo_acceso === codigoNormalizado) {
      console.log("[login] Codigo exacto coincide");
      tecnico = candidato;
      break;
    }
    
    if (candidato.hash_codigo_acceso && await codigoCoincideConHash(codigoNormalizado, candidato.hash_codigo_acceso)) {
      console.log("[login] Hash coincide");
      tecnico = candidato;
      break;
    }
  }

  if (!tecnico) {
    console.log("[login] Ningun tecnico coincide");
    return { success: false, error: "Código inválido o expirado" };
  }

  console.log("[login] Tecnico encontrado:", tecnico.nombre, "id:", tecnico.id, "activo:", tecnico.activo);

  if (tecnico.activo === false || tecnico.activo === null || tecnico.activo === 'false') {
    console.log("[login] Usuario inactivo o nulo");
    return { success: false, error: "usuario_inactivo" };
  }

  const fechaLimiteVencida = tecnico.fecha_limite
    ? new Date(tecnico.fecha_limite).getTime() < Date.now()
    : false;
  const corteAplicado = tieneCorteActivo(tecnico.estado_corte);

  if (fechaLimiteVencida || corteAplicado) {
    console.log("[login] Periodo vencido o corte activo");
    return { success: false, error: "periodo_vencido" };
  }

  const token = await signJwt({ sub: tecnico.id, nombre: tecnico.nombre, rol: "tecnico" });
  console.log("[login] Token generado:", token.slice(0, 20) + "...");

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
    console.log("[login] Sesion guardada en Redis");
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
