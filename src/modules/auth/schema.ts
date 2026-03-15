import { z } from "zod";

export const loginSchema = z.object({
  codigo: z
    .string()
    .length(5, "El código debe tener exactamente 5 dígitos")
    .regex(/^\d{5}$/, "Solo dígitos numéricos"),
});
