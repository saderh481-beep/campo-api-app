import { v2 as cloudinary, type UploadApiOptions } from "cloudinary";
import { createHash, createHmac } from "node:crypto";
import { env, requireEnv } from "@/config/env";

let configured = false;

function cloudinaryEnvConfigured() {
  const hasCredentials = Boolean(
    env.CLOUDINARY_CLOUD_NAME?.trim() &&
      env.CLOUDINARY_API_KEY?.trim() &&
      env.CLOUDINARY_API_SECRET?.trim()
  );
  const hasPresets = Boolean(
    env.CLOUDINARY_PRESET_IMAGENES?.trim() ||
      env.CLOUDINARY_PRESET_DOCS?.trim()
  );
  const configured = hasCredentials && hasPresets;
  console.log("[Cloudinary] envConfigured:", configured, "cloudName:", env.CLOUDINARY_CLOUD_NAME, "hasPresets:", hasPresets);
  return configured;
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

export interface UploadSignature {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  publicId?: string;
  resourceType: "image" | "raw";
}

function generateSignature(timestamp: number, folder: string, publicId?: string): string {
  const apiSecret = requireEnv("CLOUDINARY_API_SECRET");
  const params: string[] = [`timestamp=${timestamp}`, `folder=${folder}`];
  if (publicId) {
    params.push(`public_id=${publicId}`);
  }
  params.sort();
  const payload = params.join("&");
  const hmac = createHmac("sha256", apiSecret);
  hmac.update(payload);
  return hmac.digest("hex");
}

export function generateUploadSignature(options: {
  folder: string;
  publicId?: string;
  resourceType?: "image" | "raw";
}): UploadSignature | null {
  if (!cloudinaryEnvConfigured()) {
    return null;
  }

  ensureCloudinaryConfigured();

  const timestamp = Math.round(Date.now() / 1000);
  const signature = generateSignature(timestamp, options.folder, options.publicId);

  return {
    signature,
    timestamp,
    cloudName: requireEnv("CLOUDINARY_CLOUD_NAME"),
    apiKey: requireEnv("CLOUDINARY_API_KEY"),
    folder: options.folder,
    publicId: options.publicId,
    resourceType: options.resourceType ?? "image",
  };
}

function buildDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function upload(
  buffer: Buffer,
  options: UploadApiOptions,
  fallbackMimeType: string
): Promise<{ secure_url: string; public_id: string }> {
  console.log("[Cloudinary] Intentando subir, tiene credenciales:", cloudinaryEnvConfigured(), "preset:", options.upload_preset);
  
  if (!cloudinaryEnvConfigured()) {
    console.log("[Cloudinary] No configurado completamente, retornando data URL");
    return Promise.resolve({
      secure_url: buildDataUrl(buffer, fallbackMimeType),
      public_id: String(options.public_id ?? `local-${Date.now()}`),
    });
  }

  ensureCloudinaryConfigured();

  console.log("[Cloudinary] Subiendo con preset:", options.upload_preset, "folder:", options.folder);

  // Use base64 encoding for buffer upload - more reliable for Node.js
  const base64 = buffer.toString("base64");
  const mimeType = fallbackMimeType.includes("webp") ? "image/webp" : fallbackMimeType.includes("png") ? "image/png" : "image/jpeg";
  const dataUri = `data:${mimeType};base64,${base64}`;

  return cloudinary.uploader.upload(dataUri, options)
    .then((result) => {
      console.log("[Cloudinary] Upload exitoso:", result.secure_url);
      return { secure_url: result.secure_url, public_id: result.public_id };
    })
    .catch((err) => {
      console.error("[Cloudinary] Error uploading:", err);
      throw err;
    });
}

export async function subirFotoRostro(buffer: Buffer, bitacoraId: string) {
  const preset = requireEnv("CLOUDINARY_PRESET_IMAGENES");
  console.log("[Cloudinary] subirFotoRostro preset:", preset);
  return upload(buffer, {
    upload_preset: preset,
    folder: `campo/rostros/${bitacoraId}`,
    public_id: `rostro-${bitacoraId}`,
    resource_type: "image",
  }, "image/jpeg");
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
