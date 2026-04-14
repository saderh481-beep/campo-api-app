import type { Context, Next } from "hono";
import { env } from "@/config/env";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_DOCUMENT_TYPES = ["application/pdf"];
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];

export interface UploadValidationOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
  fieldName?: string;
}

async function validateUpload(c: Context, next: Next, options: UploadValidationOptions = {}) {
  const maxSizeMB = options.maxSizeMB ?? env.MAX_UPLOAD_SIZE_MB ?? 10;
  const allowedTypes = options.allowedTypes ?? ALLOWED_MIME_TYPES;
  const fieldName = options.fieldName ?? "file";
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  try {
    const contentType = c.req.header("content-type") ?? "";
    const contentLength = c.req.header("content-length");

    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      return c.json({
        error: "Archivo demasiado grande",
        maxSizeMB,
        receivedSizeMB: (parseInt(contentLength) / (1024 * 1024)).toFixed(2)
      }, 413);
    }

    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.formData();
      const file = formData.get(fieldName);

      if (file instanceof File) {
        if (!allowedTypes.includes(file.type)) {
          return c.json({
            error: "Tipo de archivo no permitido",
            allowedTypes,
            receivedType: file.type
          }, 400);
        }

        if (file.size > maxSizeBytes) {
          return c.json({
            error: "Archivo demasiado grande",
            maxSizeMB,
            receivedSizeMB: (file.size / (1024 * 1024)).toFixed(2)
          }, 413);
        }
      }
    }
  } catch (e) {
    console.error("[validateUpload] Error:", e);
  }

  await next();
}

export function validateUploadMiddleware(options?: UploadValidationOptions) {
  return async (c: Context, next: Next) => {
    return validateUpload(c, next, options);
  };
}

export function validateImageUpload(options?: UploadValidationOptions) {
  return validateUploadMiddleware({
    ...options,
    allowedTypes: ALLOWED_IMAGE_TYPES,
  });
}

export function validateDocumentUpload(options?: UploadValidationOptions) {
  return validateUploadMiddleware({
    ...options,
    allowedTypes: ALLOWED_DOCUMENT_TYPES,
  });
}

export function validateMultipleImages(maxFiles = 10) {
  return validateUploadMiddleware({
    allowedTypes: ALLOWED_IMAGE_TYPES,
  });
}
