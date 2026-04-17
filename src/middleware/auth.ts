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
  console.log("[auth] Buscando usuario con ID:", tecnicoId);
  
  const [tecnico] = await sql`
    SELECT id, nombre, activo, fecha_limite, estado_corte
    FROM usuarios
    WHERE id = ${tecnicoId}
    LIMIT 1
  `;

  console.log("[auth] Usuario encontrado:", tecnico ? tecnico.nombre : "NO ENCONTRADO");
  return tecnico || null;
}

export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  console.log("[auth] Token recibido:", token ? token.slice(0, 30) + "..." : "null");

  if (!token) {
    console.log("[auth] No hay token");
    return c.json({ error: "no_autenticado", message: "No se proporcionó token de autenticación" }, 401);
  }

  const payload = await verifyJwt(token);
  if (!payload) {
    console.log("[auth] Token inválido o no verificado");
    return c.json({ error: "token_invalido", message: "Token inválido o expirado" }, 401);
  }

  console.log("[auth] Payload:", JSON.stringify(payload));

  let tecnico = payload;
  
  let sessionRaw: string | null = null;
  try {
    sessionRaw = await redis.get(`session:${token}`);
    console.log("[auth] Redis session:", sessionRaw ? "encontrada" : "no encontrada");
  } catch (error) {
    console.error("[auth] Error consultando Redis:", error);
  }

  if (sessionRaw) {
    try {
      tecnico = JSON.parse(sessionRaw) as JwtPayload;
    } catch {
      tecnico = payload;
    }
  }
  c.set("tecnico", tecnico);

  if (!c.get("tecnico")) {
    console.log("[auth] No hay tecnico en payload");
    return c.json({ error: "token_invalido", message: "Token inválido o expirado" }, 401);
  }

  const tecnicoData = c.get("tecnico");
  console.log("[auth] Tecnico del token:", tecnicoData.sub, tecnicoData.nombre);
  
  let tecnicoActual;
  try {
    tecnicoActual = await obtenerTecnicoActual(tecnicoData.sub);
  } catch (error) {
    console.error("[auth] Error consultando usuario:", error);
    return c.json({ error: "servicio_no_disponible", message: "Error de conexión con la base de datos" }, 503);
  }

  console.log("[auth] Tecnico de DB:", JSON.stringify(tecnicoActual));

  if (!tecnicoActual) {
    console.log("[auth] Usuario no encontrado en BD");
    return c.json({ error: "usuario_no_encontrado", message: "Usuario no encontrado en base de datos" }, 401);
  }

  if (tecnicoActual.activo === false || tecnicoActual.activo === null || tecnicoActual.activo === 'false') {
    console.log("[auth] Usuario inactivo, activo值为:", tecnicoActual.activo);
    return c.json({ error: "usuario_inactivo", message: "Usuario inactivo o eliminado" }, 401);
  }

  const fechaLimiteVencida = tecnicoActual.fecha_limite 
    ? new Date(tecnicoActual.fecha_limite).getTime() < Date.now() 
    : false;

  const estadoCorte = (tecnicoActual.estado_corte ?? "").trim().toLowerCase();
  const corteAplicado = estadoCorte !== "" && estadoCorte !== "en_servicio" && estadoCorte !== "activo";

  console.log("[auth] fecha_limite:", tecnicoActual.fecha_limite, "vencida:", fechaLimiteVencida);
  console.log("[auth] estado_corte:", tecnicoActual.estado_corte, "corteAplicado:", corteAplicado);

  if (fechaLimiteVencida || corteAplicado) {
    try {
      await redis.del(`session:${token}`);
    } catch (error) {
      console.error("[auth] Error invalidando sesión:", error);
    }
    return c.json({ error: "periodo_vencido", message: "Período de trabajo vencido. Contacta a tu coordinador." }, 401);
  }

  console.log("[auth] Autenticación exitosa!");
  await next();
});