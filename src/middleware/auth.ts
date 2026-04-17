import { verifyJwt, type JwtPayload } from "@/lib/jwt";
import { sql } from "@/db";
import { redis } from "@/lib/redis";
import { createMiddleware } from "hono/factory";

export type Env = {
  Variables: {
    tecnico: JwtPayload
  }
};

async function obtenerTecnicoActual(tecnicoId: string) {
  try {
    const [tecnico] = await sql`
      SELECT activo, fecha_limite, estado_corte
      FROM usuarios
      WHERE id = ${tecnicoId}
      LIMIT 1
    `;

    return tecnico as
      | { activo: boolean | null; fecha_limite: string | Date | null; estado_corte: string | null }
      | undefined;
  } catch (error) {
    if ((error as { code?: string })?.code !== "42703") {
      throw error;
    }
  }

  try {
    const [tecnico] = await sql`
      SELECT fecha_limite, estado_corte
      FROM usuarios
      WHERE id = ${tecnicoId}
      LIMIT 1
    `;

    return tecnico as
      | { activo?: boolean | null; fecha_limite: string | Date | null; estado_corte: string | null }
      | undefined;
  } catch (error) {
    if ((error as { code?: string })?.code !== "42703") {
      throw error;
    }
  }

  try {
    const [tecnico] = await sql`
      SELECT estado_corte
      FROM usuarios
      WHERE id = ${tecnicoId}
      LIMIT 1
    `;

    return tecnico as
      | { activo?: boolean | null; fecha_limite?: string | Date | null; estado_corte: string | null }
      | undefined;
  } catch (error) {
    if ((error as { code?: string })?.code !== "42703") {
      throw error;
    }
  }

  const [tecnico] = await sql`
    SELECT id
    FROM usuarios
    WHERE id = ${tecnicoId}
    LIMIT 1
  `;

  return tecnico as
    | { activo?: boolean | null; fecha_limite?: string | Date | null; estado_corte?: string | null }
    | undefined;
}

export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return c.json({ error: "no_autenticado", message: "No se proporcionó token de autenticación" }, 401);

  console.log(`[AUTH] Token extracted: ${token.slice(0,20)}...`);\n  const payload = await verifyJwt(token);\n  if (!payload) {\n    console.error(`[AUTH] JWT verify failed for token: ${token.slice(0,20)}...`);\n    return c.json({ error: "token_invalido", message: "Token inválido o expirado" }, 401);\n  }\n  console.log(`[AUTH] JWT payload: sub=${payload.sub.slice(0,8)}..., rol=${payload.rol || 'none'}`);

  console.log(`[AUTH] Loading Redis session for token: ${token.slice(0,20)}...`);\n  let sessionRaw: string | null = null;\n  try {\n    sessionRaw = await redis.get(`session:${token}`);\n  } catch (error) {\n    console.error("[auth] No se pudo consultar Redis, se usará el payload JWT:", error);\n  }\n  console.log(`[AUTH] Redis session: ${sessionRaw ? 'found' : 'not found'}`);

  if (sessionRaw) {
    try {
      c.set("tecnico", JSON.parse(sessionRaw) as JwtPayload);
    } catch {
      c.set("tecnico", payload);
    }
  } else {
    c.set("tecnico", payload);
  }

  if (!c.get("tecnico")) {
    return c.json({ error: "token_invalido", message: "Token inválido o expirado" }, 401);
  }

  const tecnico = c.get("tecnico");
  console.log(`[AUTH] Querying DB for tecnico sub=${tecnico.sub.slice(0,8)}...`);\n  let tecnicoActual:\n    | { activo?: boolean | null; fecha_limite?: string | Date | null; estado_corte?: string | null }\n    | undefined;\n  try {\n    tecnicoActual = await obtenerTecnicoActual(tecnico.sub);\n    console.log(`[AUTH] DB tecnico found: ${!!tecnicoActual}, activo=${tecnicoActual?.activo}, limite=${tecnicoActual?.fecha_limite}, corte='${tecnicoActual?.estado_corte}'`);\n  } catch (error) {\n    console.error("[auth] No se pudo validar el usuario en base de datos:", error);\n    return c.json({ error: "servicio_no_disponible", message: "Error de conexión con la base de datos" }, 503);\n  }

  if (!tecnicoActual || ("activo" in tecnicoActual && tecnicoActual.activo === false)) {\n    console.error(`[AUTH] Reject usuario_inactivo for sub=${tecnico.sub.slice(0,8)}... tecnicoActual=`, tecnicoActual);\n    return c.json({ error: "usuario_inactivo", message: "Usuario inactivo o eliminado" }, 401);\n  }

  const fechaLimiteVencida = tecnicoActual.fecha_limite\n    ? new Date(tecnicoActual.fecha_limite).getTime() < Date.now()\n    : false;\n  console.log(`[AUTH] fechaLimiteVencida=${fechaLimiteVencida}, now=${new Date().toISOString().slice(0,19)}`);\n  const estadoCorte = (tecnicoActual.estado_corte ?? "").trim().toLowerCase();\n  const corteAplicado = estadoCorte !== "" && estadoCorte !== "en_servicio" && estadoCorte !== "activo";\n  console.log(`[AUTH] estadoCorte='${estadoCorte}', corteAplicado=${corteAplicado}`);

  if (fechaLimiteVencida || corteAplicado) {
    try {
      await redis.del(`session:${token}`);
    } catch (error) {
      console.error("[auth] No se pudo invalidar la sesión vencida:", error);
    }
    return c.json({ error: "periodo_vencido", message: "Período de trabajo vencido. Contacta a tu coordinador." }, 401);
  }

  await next();
});
