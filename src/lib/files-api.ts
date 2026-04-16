import { requireEnv } from "../config/env";
import { env } from "../config/env";

const FILES_API_URL = env.CAMPO_FILES_API_URL || env.FILES_API_URL || "https://campo-api-files-campo-saas.up.railway.app";
const FILES_API_KEY_APP = env.API_KEY_APP || env.FILES_API_KEY_APP;

interface UploadResult {
  success: boolean;
  url?: string;
  public_id?: string;
  error?: string;
}

interface FotoCampoResult {
  success: boolean;
  bitacora_id?: string;
  fotos?: Array<{
    url: string;
    public_id: string;
    thumbnail: string;
    original_filename: string;
    bytes: number;
    format: string;
  }>;
  total?: number;
  error?: string;
}

function getApiKey(): string {
  if (!FILES_API_KEY_APP) {
    throw new Error("FILES_API_KEY_APP no configurado");
  }
  return FILES_API_KEY_APP;
}

export async function uploadFirma(bitacoraId: string, buffer: Buffer, filename: string): Promise<UploadResult> {
  try {
    const formData = new FormData();
    formData.append("bitacora_id", bitacoraId);
    
    const uint8Array = new Uint8Array(buffer);
    const blob = new Blob([uint8Array], { type: "image/png" });
    const file = new File([blob], filename, { type: "image/png" });
    formData.append("files", file);

    const response = await fetch(`${FILES_API_URL}/upload/firma`, {
      method: "POST",
      headers: {
        "X-API-Key": getApiKey(),
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.error || "Error al subir firma" };
    }

    return {
      success: true,
      url: data.url,
      public_id: data.public_id,
    };
  } catch (err) {
    console.error("[files-api] Error subiendo firma:", err);
    return { success: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function uploadFotoRostro(bitacoraId: string, buffer: Buffer, filename: string): Promise<UploadResult> {
  try {
    const formData = new FormData();
    formData.append("bitacora_id", bitacoraId);
    
    const uint8Array = new Uint8Array(buffer);
    const blob = new Blob([uint8Array], { type: "image/jpeg" });
    const file = new File([blob], filename, { type: "image/jpeg" });
    formData.append("files", file);

    const response = await fetch(`${FILES_API_URL}/upload/foto-rostro`, {
      method: "POST",
      headers: {
        "X-API-Key": getApiKey(),
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.error || "Error al subir foto de rostro" };
    }

    return {
      success: true,
      url: data.url,
      public_id: data.public_id,
    };
  } catch (err) {
    console.error("[files-api] Error subiendo foto de rostro:", err);
    return { success: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function uploadFotosCampo(
  bitacoraId: string, 
  tecnicoId: string, 
  buffers: Buffer[], 
  filenames: string[]
): Promise<FotoCampoResult> {
  try {
    const formData = new FormData();
    formData.append("bitacora_id", bitacoraId);
    formData.append("tecnico_id", tecnicoId);

    for (let i = 0; i < buffers.length; i++) {
      const uint8Array = new Uint8Array(buffers[i]);
      const blob = new Blob([uint8Array], { type: "image/jpeg" });
      const file = new File([blob], filenames[i] || `foto_${i}.jpg`, { type: "image/jpeg" });
      formData.append("files", file);
    }

    const response = await fetch(`${FILES_API_URL}/upload/fotos-campo`, {
      method: "POST",
      headers: {
        "X-API-Key": getApiKey(),
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.error || "Error al subir fotos de campo" };
    }

    return {
      success: true,
      bitacora_id: data.bitacora_id,
      fotos: data.fotos,
      total: data.total,
    };
  } catch (err) {
    console.error("[files-api] Error subiendo fotos de campo:", err);
    return { success: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function uploadFirmaFromBase64(bitacoraId: string, base64Data: string): Promise<UploadResult> {
  try {
    const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      return { success: false, error: "Formato base64 inválido" };
    }

    const mimeType = base64Match[1];
    const base64 = base64Match[2];
    const buffer = Buffer.from(base64, "base64");
    
    const extension = mimeType.includes("png") ? "png" : "jpg";
    const filename = `firma_${Date.now()}.${extension}`;

    return await uploadFirma(bitacoraId, buffer, filename);
  } catch (err) {
    console.error("[files-api] Error procesando firma base64:", err);
    return { success: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function uploadFotoRostroFromBase64(bitacoraId: string, base64Data: string): Promise<UploadResult> {
  try {
    const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      return { success: false, error: "Formato base64 inválido" };
    }

    const mimeType = base64Match[1];
    const base64 = base64Match[2];
    const buffer = Buffer.from(base64, "base64");
    
    const extension = mimeType.includes("png") ? "png" : "jpg";
    const filename = `rostro_${Date.now()}.${extension}`;

    return await uploadFotoRostro(bitacoraId, buffer, filename);
  } catch (err) {
    console.error("[files-api] Error procesando foto rostro base64:", err);
    return { success: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function uploadFotosCampoFromBase64(bitacoraId: string, tecnicoId: string, base64Array: string[]): Promise<FotoCampoResult> {
  try {
    const buffers: Buffer[] = [];
    const filenames: string[] = [];

    for (let i = 0; i < base64Array.length; i++) {
      const base64Data = base64Array[i];
      const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) {
        console.warn(`[files-api] Fotos campo: formato inválido en índice ${i},saltando`);
        continue;
      }

      const mimeType = base64Match[1];
      const base64 = base64Match[2];
      const buffer = Buffer.from(base64, "base64");
      const extension = mimeType.includes("png") ? "png" : "jpg";
      
      buffers.push(buffer);
      filenames.push(`campo_${Date.now()}_${i}.${extension}`);
    }

    if (buffers.length === 0) {
      return { success: false, error: "No hay imágenes válidas para procesar" };
    }

    return await uploadFotosCampo(bitacoraId, tecnicoId, buffers, filenames);
  } catch (err) {
    console.error("[files-api] Error procesando fotos campo base64:", err);
    return { success: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
