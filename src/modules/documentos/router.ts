import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "@/middleware/auth";
import { sql } from "@/config/db";
import { subirDocumento, eliminarArchivo } from "@/lib/upload";
import { AppError, NotFoundError } from "@/lib/errors";

const router = new Hono();
router.use("*", requireAuth);

// GET /documentos/:beneficiarioId — listar documentos del beneficiario
router.get("/:beneficiarioId", async (c) => {
  const tecnicoId     = c.get("jwtPayload").sub;
  const beneficiarioId = c.req.param("beneficiarioId");

  // Verificar que el beneficiario pertenece al técnico
  const [ben] = await sql`
    SELECT id FROM beneficiarios
    WHERE id = ${beneficiarioId} AND tecnico_id = ${tecnicoId}
  `;
  if (!ben) throw new NotFoundError("Beneficiario");

  const docs = await sql`
    SELECT id, nombre, tipo, url, creado_en
    FROM documentos
    WHERE beneficiario_id = ${beneficiarioId}
    ORDER BY creado_en DESC
  `;

  return c.json({ data: docs });
});

// POST /documentos/:beneficiarioId — subir documento
// form-data: archivo + nombre + tipo
router.post("/:beneficiarioId", async (c) => {
  const tecnicoId      = c.get("jwtPayload").sub;
  const beneficiarioId = c.req.param("beneficiarioId");

  // Verificar pertenencia
  const [ben] = await sql`
    SELECT id FROM beneficiarios
    WHERE id = ${beneficiarioId} AND tecnico_id = ${tecnicoId}
  `;
  if (!ben) throw new NotFoundError("Beneficiario");

  const formData = await c.req.formData();
  const file     = formData.get("archivo") as File | null;
  const nombre   = formData.get("nombre") as string | null;
  const tipo     = formData.get("tipo") as string | null;

  if (!file)   throw new AppError("Campo 'archivo' requerido", 400);
  if (!nombre) throw new AppError("Campo 'nombre' requerido", 400);
  if (!tipo)   throw new AppError("Campo 'tipo' requerido (ej: INE, acta, croquis)", 400);

  const { url, publicId } = await subirDocumento(file, beneficiarioId, nombre);

  const [doc] = await sql`
    INSERT INTO documentos (beneficiario_id, nombre, tipo, url, cloudinary_id)
    VALUES (${beneficiarioId}, ${nombre}, ${tipo}, ${url}, ${publicId})
    RETURNING id, nombre, tipo, url, creado_en
  `;

  return c.json({ ok: true, documento: doc }, 201);
});

// DELETE /documentos/:beneficiarioId/:documentoId
router.delete("/:beneficiarioId/:documentoId", async (c) => {
  const tecnicoId      = c.get("jwtPayload").sub;
  const beneficiarioId = c.req.param("beneficiarioId");
  const documentoId    = c.req.param("documentoId");

  // Verificar pertenencia
  const [doc] = await sql`
    SELECT d.id, d.cloudinary_id, d.tipo FROM documentos d
    JOIN beneficiarios b ON b.id = d.beneficiario_id
    WHERE d.id = ${documentoId}
      AND d.beneficiario_id = ${beneficiarioId}
      AND b.tecnico_id = ${tecnicoId}
  `;
  if (!doc) throw new NotFoundError("Documento");

  // Eliminar de Cloudinary
  const resourceType = doc.tipo === "application/pdf" ? "raw" : "image";
  await eliminarArchivo(doc.cloudinaryId, resourceType);

  // Eliminar de BD
  await sql`DELETE FROM documentos WHERE id = ${documentoId}`;

  return c.json({ ok: true });
});

export default router;