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

  if (!token) {
    console.log('[AUTH] No token provided');
    return c.json({ error: "no_autentica", message: "No se proporcionó token de autenticación" }, 401);
  }

  console.log(`[AUTH] Processing token: ${token.slice(0,20)}...`);

  const payload = await verifyJwt(token);
  if (!payload) {
    console.error(`[AUTH] JWT verification failed for token ${token.slice(0,20)}...`);
    return c.json({ error: "token_invalido", message: "Token inválido o expirado" }, 401);
  }

  console.log(`[AUTH] JWT payload: sub=${payload.sub.slice(0,8)}..., nombre=${payload.nombre}, rol=${payload.rol || 'n/a'}`);

  let sessionRaw: string | null = null;
  try {
    sessionRaw = await redis.get(`session:${token}`);
    console.log(`[AUTH] Redis session for token ${token.slice(0,20)}...: ${sessionRaw ? 'found (' + sessionRaw.length + ' chars)' : 'not found'}`);
  } catch (error) {
    console.error("[AUTH] Redis get error:", error);
  }

  let tecnico = payload;
  if (sessionRaw) {
    try {
      tecnico = JSON.parse(sessionRaw) as JwtPayload;
    } catch {
      console.log('[AUTH] Invalid Redis session JSON, using JWT payload');
    }
  }
  c.set("tecnico", tecnico);

  if (!c.get("tecnico")) {
    console.error('[AUTH] No tecnico set');
    return c.json({ error: "token_invalido", message: "Token inválido o expirado" }, 401);
  }

  const tecnicoData = c.get("tecnico");
  console.log(`[AUTH] Using tecnico sub=${tecnicoData.sub.slice(0,8)}...`);

  let tecnicoActual;
  try {
    tecnicoActual = await obtenerTecnicoActual(tecnicoData.sub);
    console.log(`[AUTH] DB lookup: found=${!!tecnicoActual}, activo=${JSON.stringify(tecnicoActual?.activo)}, fecha_limite=${JSON.stringify(tecnicoActual?.fecha_limite)}, estado_corte='${tecnicoActual?.estado_corte || ''}'`);
  } catch (error) {
    console.error("[AUTH] DB lookup error:", error);
    return c.json({ error: "servicio_no_disponible", message: "Error de conexión con la base de datos" }, 503);
  }

  if (!tecnicoActual) {
    console.error(`[AUTH] No DB record for ${tecnicoData.sub.slice(0,8)}...`);
    return c.json({ error: "usuario_no_encontrado", message: "Usuario no encontrado en base de datos" }, 401);
  }

  if (tecnicoActual.activo === false) {
    console.error(`[AUTH] Inactive user ${tecnicoData.sub.slice(0,8)}...`);
    return c.json({ error: "usuario_inactivo", message: "Usuario inactivo o eliminado" }, 401);
  }

  const fechaLimiteVencida = tecnicoActual.fecha_limite ? new Date(tecnicoActual.fecha_limite).getTime() < Date.now() : false;
  console.log(`[AUTH] Period check: fechaLimiteVencida=${fechaLimiteVencida} (limite=${tecnicoActual.fecha_limite}, now=${new Date().toISOString().slice(0,19)})`);

  const estadoCorte = (tecnicoActual.estado_corte ?? "").trim().toLowerCase();
  const corteAplicado = estadoCorte !== "" && estadoCorte !== "en_servicio" && estadoCorte !== "activo";
  console.log(`[AUTH] Corte check: estado='${estadoCorte}', corteAplicado=${corteAplicado}`);

  if (fechaLimiteVencida || corteAplicado) {
    console.error(`[AUTH] Reject periodo_vencido/corte for ${tecnicoData.sub.slice(0,8)}...: limiteVencida=${fechaLimiteVencida}, corte=${corteAplicado}, estado='${estadoCorte}'`);
    try {
      await redis.del(`session:${token}`);
    } catch (error) {
      console.error("[AUTH] Could not del expired session:", error);
    }
    return c.json({ error: "periodo_vencido", message: "Período de trabajo vencido. Contacta a tu coordinador." }, 401);
  }

  console.log(`[AUTH] Auth OK for ${tecnicoData.sub.slice(0,8)}...`);
  await next();
});
