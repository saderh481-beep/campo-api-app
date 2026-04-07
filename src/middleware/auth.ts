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

  if (!token) return c.json({ error: "No autenticado" }, 401);

  const payload = await verifyJwt(token);
  if (!payload) return c.json({ error: "Token inválido o expirado" }, 401);

  let sessionRaw: string | null = null;
  try {
    sessionRaw = await redis.get(`session:${token}`);
  } catch (error) {
    console.error("[auth] No se pudo consultar Redis, se usará el payload JWT:", error);
  }

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
    return c.json({ error: "Token inválido o expirado" }, 401);
  }

  const tecnico = c.get("tecnico");
  let tecnicoActual:
    | { activo?: boolean | null; fecha_limite?: string | Date | null; estado_corte?: string | null }
    | undefined;
  try {
    tecnicoActual = await obtenerTecnicoActual(tecnico.sub);
  } catch (error) {
    console.error("[auth] No se pudo validar el usuario en base de datos:", error);
    return c.json({ error: "Servicio de autenticación no disponible" }, 503);
  }

  if (!tecnicoActual || ("activo" in tecnicoActual && tecnicoActual.activo === false)) {
    return c.json({ error: "Token inválido o expirado" }, 401);
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
      console.error("[auth] No se pudo invalidar la sesión vencida:", error);
    }
    return c.json({ error: "periodo_vencido" }, 401);
  }

  await next();
});
