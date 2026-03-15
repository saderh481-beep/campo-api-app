import { cloudinary, FOLDERS } from "@/config/cloudinary";
import { AppError } from "@/lib/errors";

const MAX_SIZES = {
  imagen:  10 * 1024 * 1024,  // 10 MB
  pdf:     20 * 1024 * 1024,  // 20 MB
  firma:    2 * 1024 * 1024,  //  2 MB
};

const MIME_PERMITIDOS = {
  imagen: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  pdf:    ["application/pdf"],
  firma:  ["image/png", "image/jpeg"],
};

// ── Leer body multipart y extraer archivo ──────────────────────────────────────
export async function extraerArchivo(req: Request, campo = "archivo") {
  const formData = await req.formData();
  const file     = formData.get(campo) as File | null;
  if (!file) throw new AppError(`Campo '${campo}' requerido`, 400);
  return file;
}

// ── Validar tipo y tamaño ──────────────────────────────────────────────────────
function validar(file: File, tipo: keyof typeof MAX_SIZES) {
  if (file.size > MAX_SIZES[tipo]) {
    const mb = MAX_SIZES[tipo] / 1024 / 1024;
    throw new AppError(`El archivo supera el límite de ${mb} MB`, 400);
  }
  if (!MIME_PERMITIDOS[tipo].includes(file.type)) {
    throw new AppError(`Tipo de archivo no permitido: ${file.type}`, 400);
  }
}

// ── Subir a Cloudinary desde un File ──────────────────────────────────────────
async function subirBuffer(
  buffer: ArrayBuffer,
  folder: string,
  publicId: string,
  options: Record<string, unknown> = {}
) {
  const b64    = Buffer.from(buffer).toString("base64");
  const uri    = `data:image/jpeg;base64,${b64}`;

  return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    cloudinary.uploader.upload(uri, {
      folder,
      public_id:      publicId,
      overwrite:      true,
      resource_type:  "auto",
      ...options,
    }, (err, result) => {
      if (err || !result) return reject(new AppError("Error al subir archivo", 500));
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
  });
}

// ── Foto de rostro del beneficiario ───────────────────────────────────────────
export async function subirFotoRostro(file: File, bitacoraId: string) {
  validar(file, "imagen");
  const buffer = await file.arrayBuffer();
  return subirBuffer(buffer, FOLDERS.fotoRostro(bitacoraId), "rostro", {
    transformation: [
      { width: 800, height: 800, crop: "limit" },
      { quality: "auto:good", fetch_format: "webp" },
    ],
  });
}

// ── Firma táctil del beneficiario ─────────────────────────────────────────────
export async function subirFirma(file: File, bitacoraId: string) {
  validar(file, "firma");
  const buffer = await file.arrayBuffer();
  return subirBuffer(buffer, FOLDERS.firma(bitacoraId), "firma", {
    transformation: [{ quality: "auto", fetch_format: "png" }],
  });
}

// ── Fotos de campo (hasta 5 por bitácora) ─────────────────────────────────────
export async function subirFotoCampo(file: File, bitacoraId: string, indice: number) {
  validar(file, "imagen");
  const buffer = await file.arrayBuffer();
  return subirBuffer(buffer, FOLDERS.fotoCampo(bitacoraId), `foto-${indice}`, {
    transformation: [
      { width: 1200, crop: "limit" },
      { quality: "auto:good", fetch_format: "webp" },
      // Preservar metadatos GPS
      { flags: "keep_iptc" },
    ],
  });
}

// ── PDF de bitácora ───────────────────────────────────────────────────────────
export async function subirPDF(
  pdfBuffer: Buffer,
  bitacoraId: string,
  version: number
) {
  const b64 = pdfBuffer.toString("base64");
  const uri = `data:application/pdf;base64,${b64}`;

  return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    cloudinary.uploader.upload(uri, {
      folder:        FOLDERS.pdf(bitacoraId),
      public_id:     `v${version}`,
      overwrite:     true,
      resource_type: "raw",   // PDFs van como raw, no image
    }, (err, result) => {
      if (err || !result) return reject(new AppError("Error al subir PDF", 500));
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
  });
}

// ── Documento de beneficiario (INE, acta, etc.) ───────────────────────────────
export async function subirDocumento(
  file: File,
  beneficiarioId: string,
  nombre: string
) {
  const esPDF   = file.type === "application/pdf";
  const esImagen = MIME_PERMITIDOS.imagen.includes(file.type);

  if (!esPDF && !esImagen) {
    throw new AppError("Solo se permiten imágenes o PDFs", 400);
  }
  if (file.size > MAX_SIZES.pdf) {
    throw new AppError("El archivo supera 20 MB", 400);
  }

  const buffer = await file.arrayBuffer();
  const b64    = Buffer.from(buffer).toString("base64");
  const mime   = file.type;
  const uri    = `data:${mime};base64,${b64}`;
  const slug   = nombre.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    cloudinary.uploader.upload(uri, {
      folder:        FOLDERS.docBeneficiario(beneficiarioId),
      public_id:     slug,
      overwrite:     false,   // documentos no se sobreescriben
      resource_type: esPDF ? "raw" : "image",
    }, (err, result) => {
      if (err || !result) return reject(new AppError("Error al subir documento", 500));
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
  });
}

// ── Eliminar archivo ──────────────────────────────────────────────────────────
export async function eliminarArchivo(publicId: string, tipo: "image" | "raw" = "image") {
  return cloudinary.uploader.destroy(publicId, { resource_type: tipo });
}