import { Hono } from "hono";
import { requireAuth } from "@/middleware/auth";
import { sql } from "@/config/db";
import {
  subirFotoRostro,
  subirFirma,
  subirFotoCampo,
  subirDocumento,
} from "@/lib/upload";
import { AppError, NotFoundError } from "@/lib/errors";

const router = new Hono();
router.use("*", requireAuth);

// ── Verificar que la bitácora pertenece al técnico y está en borrador ──────────
async function verificarBitacora(id: string, tecnicoId: string) {
  const [b] = await sql`
    SELECT id, estado FROM bitacoras
    WHERE id = ${id} AND tecnico_id = ${tecnicoId}
  `;
  if (!b) throw new NotFoundError("Bitácora");
  if (b.estado === "cerrada") throw new AppError("La bitácora ya está cerrada", 400);
  return b;
}

// POST /bitacoras/:id/foto-rostro
// form-data: archivo (image/jpeg|png|webp)
router.post("/:id/foto-rostro", async (c) => {
  const tecnicoId  = c.get("jwtPayload").sub;
  const bitacoraId = c.req.param("id");
  await verificarBitacora(bitacoraId, tecnicoId);

  const formData = await c.req.formData();
  const file     = formData.get("archivo") as File | null;
  if (!file) throw new AppError("Campo 'archivo' requerido", 400);

  const { url, publicId } = await subirFotoRostro(file, bitacoraId);

  // Guardar URL en la bitácora
  await sql`
    UPDATE bitacoras SET foto_rostro_url = ${url}, foto_rostro_id = ${publicId}
    WHERE id = ${bitacoraId}
  `;

  return c.json({ ok: true, url });
});

// POST /bitacoras/:id/firma
// form-data: archivo (image/png)
router.post("/:id/firma", async (c) => {
  const tecnicoId  = c.get("jwtPayload").sub;
  const bitacoraId = c.req.param("id");
  await verificarBitacora(bitacoraId, tecnicoId);

  const formData = await c.req.formData();
  const file     = formData.get("archivo") as File | null;
  if (!file) throw new AppError("Campo 'archivo' requerido", 400);

  const { url, publicId } = await subirFirma(file, bitacoraId);

  await sql`
    UPDATE bitacoras SET firma_url = ${url}, firma_id = ${publicId}
    WHERE id = ${bitacoraId}
  `;

  return c.json({ ok: true, url });
});

// POST /bitacoras/:id/fotos-campo
// form-data: archivos[] (hasta 5 imágenes)
router.post("/:id/fotos-campo", async (c) => {
  const tecnicoId  = c.get("jwtPayload").sub;
  const bitacoraId = c.req.param("id");
  await verificarBitacora(bitacoraId, tecnicoId);

  const formData = await c.req.formData();
  const archivos = formData.getAll("archivos") as File[];

  if (!archivos.length) throw new AppError("Se requiere al menos una foto", 400);
  if (archivos.length > 5) throw new AppError("Máximo 5 fotos por bitácora", 400);

  // Contar fotos ya existentes
  const [{ count }] = await sql<[{ count: number }]>`
    SELECT COALESCE(jsonb_array_length(fotos_campo), 0)::int AS count
    FROM bitacoras WHERE id = ${bitacoraId}
  `;
  if (count + archivos.length > 5) {
    throw new AppError(`Ya tienes ${count} fotos. Solo puedes agregar ${5 - count} más.`, 400);
  }

  const resultados = await Promise.all(
    archivos.map((file, i) => subirFotoCampo(file, bitacoraId, count + i + 1))
  );

  const urls = resultados.map(r => r.url);

  // Agregar URLs al array JSON en la bitácora
  await sql`
    UPDATE bitacoras
    SET fotos_campo = COALESCE(fotos_campo, '[]'::jsonb) || ${JSON.stringify(urls)}::jsonb
    WHERE id = ${bitacoraId}
  `;

  return c.json({ ok: true, urls });
});

export default router;