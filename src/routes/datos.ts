import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
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

const schemaCrearBeneficiario = z.object({
  nombre_completo: z.string().trim().min(1),
  municipio: z.string().trim().min(1),
  localidad: z.string().trim().min(1),
  telefono_contacto: z.string().trim().min(1),
  cadena_productiva: z.string().trim().min(1).optional(),
  curp: z.string().trim().optional(),
  folio_saderh: z.string().trim().optional(),
});

app.get("/mis-beneficiarios", async (c) => {
  const tecnico = c.get("tecnico");
  const beneficiarios = await sql`
    SELECT b.id, b.nombre, b.municipio, b.localidad, b.direccion, b.cp,
           b.telefono_principal, b.telefono_secundario,
           CASE
             WHEN b.coord_parcela IS NULL THEN NULL
             ELSE CONCAT('(', b.coord_parcela[0], ',', b.coord_parcela[1], ')')
           END AS coord_parcela,
           b.activo,
           COALESCE((
             SELECT json_agg(json_build_object('id', cp.id, 'nombre', cp.nombre) ORDER BY cp.nombre)
             FROM beneficiario_cadenas bc
             JOIN cadenas_productivas cp ON cp.id = bc.cadena_id
             WHERE bc.beneficiario_id = b.id
               AND bc.activo = true
               AND cp.activo = true
           ), '[]'::json) AS cadenas
    FROM asignaciones_beneficiario ab
    JOIN beneficiarios b ON b.id = ab.beneficiario_id
    WHERE ab.tecnico_id = ${tecnico.sub}
      AND ab.activo = true
      AND b.activo = true
    ORDER BY b.nombre
  `;
  return c.json(beneficiarios);
});

app.post("/beneficiarios", zValidator("json", schemaCrearBeneficiario), async (c) => {
  const tecnico = c.get("tecnico");
  const body = c.req.valid("json");

  const [nuevoBeneficiario] = await sql`
    INSERT INTO beneficiarios (
      nombre, municipio, localidad, telefono_principal, tecnico_id
    ) VALUES (
      ${body.nombre_completo},
      ${body.municipio},
      ${body.localidad},
      ${body.telefono_contacto},
      ${tecnico.sub}
    )
    RETURNING id
  `;

  await sql`
    UPDATE asignaciones_beneficiario
    SET activo = true, asignado_por = ${tecnico.sub}
    WHERE tecnico_id = ${tecnico.sub}
      AND beneficiario_id = ${nuevoBeneficiario.id}
  `;

  const [asignacion] = await sql`
    SELECT tecnico_id
    FROM asignaciones_beneficiario
    WHERE tecnico_id = ${tecnico.sub}
      AND beneficiario_id = ${nuevoBeneficiario.id}
    LIMIT 1
  `;

  if (!asignacion) {
    await sql`
      INSERT INTO asignaciones_beneficiario (
        tecnico_id, beneficiario_id, asignado_por, activo
      ) VALUES (
        ${tecnico.sub},
        ${nuevoBeneficiario.id},
        ${tecnico.sub},
        true
      )
    `;
  }

  const cadenaNombre = body.cadena_productiva?.trim();
  if (cadenaNombre) {
    const [cadena] = await sql`
      SELECT id
      FROM cadenas_productivas
      WHERE activo = true
        AND LOWER(nombre) = LOWER(${cadenaNombre})
      LIMIT 1
    `;

    if (cadena) {
      await sql`
        UPDATE beneficiario_cadenas
        SET activo = true
        WHERE beneficiario_id = ${nuevoBeneficiario.id}
          AND cadena_id = ${cadena.id}
      `;

      const [relacionCadena] = await sql`
        SELECT beneficiario_id
        FROM beneficiario_cadenas
        WHERE beneficiario_id = ${nuevoBeneficiario.id}
          AND cadena_id = ${cadena.id}
        LIMIT 1
      `;

      if (!relacionCadena) {
        await sql`
          INSERT INTO beneficiario_cadenas (beneficiario_id, cadena_id, activo)
          VALUES (${nuevoBeneficiario.id}, ${cadena.id}, true)
        `;
      }
    }
  }

  const [beneficiario] = await sql`
    SELECT b.id, b.nombre, b.municipio, b.localidad, b.direccion, b.cp,
           b.telefono_principal, b.telefono_secundario,
           CASE
             WHEN b.coord_parcela IS NULL THEN NULL
             ELSE CONCAT('(', b.coord_parcela[0], ',', b.coord_parcela[1], ')')
           END AS coord_parcela,
           b.activo,
           COALESCE((
             SELECT json_agg(json_build_object('id', cp.id, 'nombre', cp.nombre) ORDER BY cp.nombre)
             FROM beneficiario_cadenas bc
             JOIN cadenas_productivas cp ON cp.id = bc.cadena_id
             WHERE bc.beneficiario_id = b.id
               AND bc.activo = true
               AND cp.activo = true
           ), '[]'::json) AS cadenas
    FROM beneficiarios b
    WHERE b.id = ${nuevoBeneficiario.id}
    LIMIT 1
  `;

  return c.json(beneficiario, 201);
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
