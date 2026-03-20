import { Hono } from "hono";
import { sql } from "@/db";
import { redis } from "@/lib/redis";
import { authMiddleware } from "@/middleware/auth";
import type { JwtPayload } from "@/lib/jwt";

const app = new Hono<{
  Variables: {
    tecnico: JwtPayload
  }
}>();
app.use("*", authMiddleware);

app.get("/mis-beneficiarios", async (c) => {
  const tecnico = c.get("tecnico");
  const beneficiarios = await sql`
    SELECT b.id, b.nombre, b.municipio, b.localidad, b.direccion, b.cp, 
           b.telefono_principal, b.telefono_secundario, b.coord_parcela, b.activo,
            COALESCE(
              json_agg(json_build_object('id', cp.id, 'nombre', cp.nombre))
              FILTER (WHERE cp.id IS NOT NULL),
              '[]'
            ) AS cadenas
    FROM asignaciones_beneficiario ab
    JOIN beneficiarios b ON b.id = ab.beneficiario_id
    LEFT JOIN beneficiario_cadenas bc ON bc.beneficiario_id = b.id
    LEFT JOIN cadenas_productivas cp ON cp.id = bc.cadena_productiva_id
    WHERE ab.tecnico_id = ${tecnico.sub} AND ab.activo = true
    GROUP BY b.id, b.nombre, b.municipio, b.localidad, b.direccion, b.cp, 
             b.telefono_principal, b.telefono_secundario, b.coord_parcela, b.activo
    ORDER BY b.nombre
  `;
  return c.json(beneficiarios);
});

app.get("/mis-actividades", async (c) => {
  const tecnico = c.get("tecnico");
  const actividades = await sql`
    SELECT a.id, a.nombre, a.descripcion, a.activo, a.created_by, a.created_at, a.updated_at
    FROM asignaciones_actividad aa
    JOIN actividades a ON a.id = aa.actividad_id
    WHERE aa.tecnico_id = ${tecnico.sub} AND aa.activo = true
    ORDER BY a.nombre
  `;
  return c.json(actividades);
});

app.get("/cadenas-productivas", async (c) => {
  const cached = await redis.get("cadenas:lista");
  if (cached) return c.json(JSON.parse(cached));

  const cadenas = await sql`
    SELECT id, nombre, descripcion, activo, created_by, created_at, updated_at 
    FROM cadenas_productivas WHERE activo = true ORDER BY nombre
  `;
  await redis.setex("cadenas:lista", 86400, JSON.stringify(cadenas));
  return c.json(cadenas);
});

export default app;
