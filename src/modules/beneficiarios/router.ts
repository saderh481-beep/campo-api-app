import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "@/middleware/auth";
import { sql } from "@/config/db";

const router = new Hono();
router.use("*", requireAuth);

const querySchema = z.object({
  q:        z.string().optional(),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /mis-beneficiarios — beneficiarios asignados al técnico autenticado
router.get("/", zValidator("query", querySchema), async (c) => {
  const { q, page, pageSize } = c.req.valid("query");
  const tecnicoId             = c.get("jwtPayload").sub;
  const offset                = (page - 1) * pageSize;

  const rows = await sql`
    SELECT
      b.id, b.nombre, b.curp, b.telefono, b.municipio, b.localidad,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT('id', cp.id, 'nombre', cp.nombre)
        ) FILTER (WHERE cp.id IS NOT NULL),
        '[]'
      ) AS cadenas
    FROM beneficiarios b
    LEFT JOIN beneficiario_cadenas bc ON bc.beneficiario_id = b.id
    LEFT JOIN cadenas_productivas  cp ON cp.id = bc.cadena_productiva_id
    WHERE b.tecnico_id = ${tecnicoId} AND b.activo = TRUE
      ${q ? sql`AND b.nombre % ${q}` : sql``}
    GROUP BY b.id
    ORDER BY b.nombre ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const [{ count }] = await sql<[{ count: number }]>`
    SELECT COUNT(*)::int AS count FROM beneficiarios
    WHERE tecnico_id = ${tecnicoId} AND activo = TRUE
      ${q ? sql`AND nombre % ${q}` : sql``}
  `;

  return c.json({ data: rows, total: count, page, pageSize });
});

// GET /mis-beneficiarios/:id
router.get("/:id", async (c) => {
  const tecnicoId = c.get("jwtPayload").sub;
  const [row]     = await sql`
    SELECT b.*, COALESCE(
      JSON_AGG(JSON_BUILD_OBJECT('id', cp.id, 'nombre', cp.nombre))
      FILTER (WHERE cp.id IS NOT NULL), '[]'
    ) AS cadenas
    FROM beneficiarios b
    LEFT JOIN beneficiario_cadenas bc ON bc.beneficiario_id = b.id
    LEFT JOIN cadenas_productivas  cp ON cp.id = bc.cadena_productiva_id
    WHERE b.id = ${c.req.param("id")} AND b.tecnico_id = ${tecnicoId}
    GROUP BY b.id
  `;
  if (!row) return c.json({ error: "Beneficiario no encontrado" }, 404);
  return c.json({ beneficiario: row });
});

export default router;
