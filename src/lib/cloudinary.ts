import { v2 as cloudinary, type UploadApiOptions } from "cloudinary";
import { env, requireEnv } from "@/config/env";

let configured = false;

function cloudinaryEnvConfigured() {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME?.trim() &&
      env.CLOUDINARY_API_KEY?.trim() &&
      env.CLOUDINARY_API_SECRET?.trim()
  );
}

function ensureCloudinaryConfigured() {
  if (configured) return;

  cloudinary.config({
    cloud_name: requireEnv("CLOUDINARY_CLOUD_NAME"),
    api_key: requireEnv("CLOUDINARY_API_KEY"),
    api_secret: requireEnv("CLOUDINARY_API_SECRET"),
  });

  configured = true;
}

function buildDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function upload(
  buffer: Buffer,
  options: UploadApiOptions,
  fallbackMimeType: string
): Promise<{ secure_url: string; public_id: string }> {
  if (!cloudinaryEnvConfigured()) {
    return Promise.resolve({
      secure_url: buildDataUrl(buffer, fallbackMimeType),
      public_id: String(options.public_id ?? `local-${Date.now()}`),
    });
  }

  ensureCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(options, (err, result) => {
        if (err || !result) return reject(err ?? new Error("Upload failed"));
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      })
      .end(buffer);
  });
}

export async function subirFotoRostro(buffer: Buffer, bitacoraId: string) {
  return upload(buffer, {
    upload_preset: requireEnv("CLOUDINARY_PRESET_IMAGENES"),
    folder: `campo/rostros/${bitacoraId}`,
    public_id: `rostro-${bitacoraId}`,
    resource_type: "image",
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face", quality: 80, fetch_format: "webp" },
    ],
  }, "image/webp");
}

export async function subirFirma(buffer: Buffer, bitacoraId: string) {
  return upload(buffer, {
    upload_preset: requireEnv("CLOUDINARY_PRESET_IMAGENES"),
    folder: `campo/firmas/${bitacoraId}`,
    public_id: `firma-${bitacoraId}`,
    resource_type: "image",
  }, "image/png");
}

export async function subirFotoCampo(buffer: Buffer, tecnicoId: string, mes: number, index: number) {
  return upload(buffer, {
    upload_preset: requireEnv("CLOUDINARY_PRESET_IMAGENES"),
    folder: `campo/fotos/${tecnicoId}/${mes}`,
    public_id: `foto-${Date.now()}-${index}`,
    resource_type: "image",
    transformation: [{ width: 1200, quality: 75, fetch_format: "webp" }],
  }, "image/webp");
}

export async function subirPdfBitacora(buffer: Buffer, tecnicoId: string, mes: number, bitacoraId: string) {
  return upload(buffer, {
    upload_preset: requireEnv("CLOUDINARY_PRESET_DOCS"),
    folder: `campo/pdfs/${tecnicoId}/${mes}`,
    public_id: `pdf-${bitacoraId}`,
    resource_type: "raw",
  }, "application/pdf");
}
