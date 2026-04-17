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
    return c.json({ error: "no_autenticado", message: "No se proporcionó token de autenticación" }, 401);
  }

  const payload = await verifyJwt(token);
  if (!payload) {
    return c.json({ error: "token_invalido", message: "Token inválido o expirado" }, 401);
  }

  let sessionRaw: string | null = null;
  try {
    sessionRaw = await redis.get(`session:${token}`);
  } catch (error) {
    console.error("[auth] Error consultando Redis:", error);
  }

  let tecnico = payload;
  if (sessionRaw) {
    try {
      tecnico = JSON.parse(sessionRaw) as JwtPayload;
    } catch {
      tecnico = payload;
    }
  }
  c.set("tecnico", tecnico);

  if (!c.get("tecnico")) {
    return c.json({ error: "token_invalido", message: "Token inválido o expirado" }, 401);
  }

  const tecnicoData = c.get("tecnico");
  
  let tecnicoActual;
  try {
    tecnicoActual = await obtenerTecnicoActual(tecnicoData.sub);
  } catch (error) {
    console.error("[auth] Error consultando usuario:", error);
    return c.json({ error: "servicio_no_disponible", message: "Error de conexión con la base de datos" }, 503);
  }

  if (!tecnicoActual) {
    return c.json({ error: "usuario_no_encontrado", message: "Usuario no encontrado en base de datos" }, 401);
  }

  if (tecnicoActual.activo === false) {
    return c.json({ error: "usuario_inactivo", message: "Usuario inactivo o eliminado" }, 401);
  }

  const fechaLimiteVencida = tecnicoActual.fecha_limite 
    ? new Date(tecnicoActual.fecha_limite).getTime() < Date.now() 
    : false;

  const estadoCorte = (tecnicoActual.estado_corte ?? "").trim().toLowerCase();
  const corteAplicado = estadoCorte !== "" && estadoCorte !== "en_servicio" && estadoCorte !== "activo";

  if (fechaLimiteVencida || corteAplicado) {
    try {
      await redis.del(`session:${token}`);
    } catch (error) {
      console.error("[auth] Error invalidando sesión:", error);
    }
    return c.json({ error: "periodo_vencido", message: "Período de trabajo vencido. Contacta a tu coordinador." }, 401);
  }

  await next();
});