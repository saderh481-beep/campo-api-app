import { verifyJwt, type JwtPayload } from "@/lib/jwt";
import { sql } from "@/db";
import { redis } from "@/lib/redis";
import { createMiddleware } from "hono/factory";

export type Env = {
  Variables: {
    tecnico: JwtPayload
  }
};

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
    console.error("[auth] No se pudo consultar Redis:", error);
    return c.json({ error: "Servicio de autenticación no disponible" }, 503);
  }

  if (!sessionRaw) {
    return c.json({ error: "Token inválido o expirado" }, 401);
  }

  try {
    c.set("tecnico", JSON.parse(sessionRaw) as JwtPayload);
  } catch {
    c.set("tecnico", payload);
  }

  const tecnico = c.get("tecnico");
  let tecnicoActual:
    | { activo: boolean | null; fecha_limite: string | Date | null; estado_corte: string | null }
    | undefined;
  try {
    [tecnicoActual] = await sql`
      SELECT activo, fecha_limite, estado_corte
      FROM usuarios
      WHERE id = ${tecnico.sub}
      LIMIT 1
    `;
  } catch (error) {
    console.error("[auth] No se pudo validar el usuario en base de datos:", error);
    return c.json({ error: "Servicio de autenticación no disponible" }, 503);
  }

  if (!tecnicoActual || tecnicoActual.activo !== true) {
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
