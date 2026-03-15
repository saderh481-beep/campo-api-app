import { Hono } from "hono";
import { requireAuth } from "@/middleware/auth";
import { sql } from "@/config/db";

const router = new Hono();
router.use("*", requireAuth);

// GET /mis-actividades — actividades asignadas al técnico autenticado
router.get("/", async (c) => {
  const tecnicoId = c.get("jwtPayload").sub;

  const actividades = await sql`
    SELECT a.id, a.nombre, a.descripcion,
           aa.id AS asignacion_id, aa.creado_en AS asignado_en
    FROM asignaciones_actividad aa
    JOIN actividades a ON a.id = aa.actividad_id
    WHERE aa.tecnico_id = ${tecnicoId}
      AND aa.activo = TRUE
      AND a.activo  = TRUE
    ORDER BY a.nombre ASC
  `;

  return c.json({ data: actividades });
});

export default router;
