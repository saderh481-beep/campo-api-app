import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key:    env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure:     true,
});

export { cloudinary };

// ── Carpetas por tipo de archivo ───────────────────────────────────────────────
// campo/{bitacora_id}/foto-rostro
// campo/{bitacora_id}/firma
// campo/{bitacora_id}/fotos/{timestamp}
// campo/{bitacora_id}/pdf/{version}
// campo/beneficiarios/{beneficiario_id}/docs/{nombre}

export const FOLDERS = {
  fotoRostro:   (bitacoraId: string) => `campo/${bitacoraId}/foto-rostro`,
  firma:        (bitacoraId: string) => `campo/${bitacoraId}/firma`,
  fotoCampo:    (bitacoraId: string) => `campo/${bitacoraId}/fotos`,
  pdf:          (bitacoraId: string) => `campo/${bitacoraId}/pdf`,
  docBeneficiario: (beneficiarioId: string) => `campo/beneficiarios/${beneficiarioId}/docs`,
} as const;