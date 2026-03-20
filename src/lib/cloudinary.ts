import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

function upload(
  buffer: Buffer,
  options: Parameters<typeof cloudinary.uploader.upload_stream>[0]
): Promise<{ secure_url: string; public_id: string }> {
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
    upload_preset: process.env.CLOUDINARY_PRESET_IMAGENES,
    folder: `campo/rostros/${bitacoraId}`,
    public_id: `rostro-${bitacoraId}`,
    resource_type: "image",
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face", quality: 80, fetch_format: "webp" },
    ],
  });
}

export async function subirFirma(buffer: Buffer, bitacoraId: string) {
  return upload(buffer, {
    upload_preset: process.env.CLOUDINARY_PRESET_IMAGENES,
    folder: `campo/firmas/${bitacoraId}`,
    public_id: `firma-${bitacoraId}`,
    resource_type: "image",
  });
}

export async function subirFotoCampo(buffer: Buffer, tecnicoId: string, mes: number, index: number) {
  return upload(buffer, {
    upload_preset: process.env.CLOUDINARY_PRESET_IMAGENES,
    folder: `campo/fotos/${tecnicoId}/${mes}`,
    public_id: `foto-${Date.now()}-${index}`,
    resource_type: "image",
    transformation: [{ width: 1200, quality: 75, fetch_format: "webp" }],
  });
}

export async function subirPdfBitacora(buffer: Buffer, tecnicoId: string, mes: number, bitacoraId: string) {
  return upload(buffer, {
    upload_preset: process.env.CLOUDINARY_PRESET_DOCS,
    folder: `campo/pdfs/${tecnicoId}/${mes}`,
    public_id: `pdf-${bitacoraId}`,
    resource_type: "raw",
  });
}
