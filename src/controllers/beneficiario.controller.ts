import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "@/middleware/auth";
import type { JwtPayload } from "@/lib/jwt";
import {
  obtenerBeneficiariosTecnico,
  crearBeneficiario,
  obtenerActividadesTecnico,
  obtenerCadenasProductivas,
  obtenerLocalidades,
} from "@/services/beneficiario.service";

const app = new Hono<{
  Variables: {
    tecnico: JwtPayload;
  };
}>();

app.use("*", authMiddleware);

const schemaCrearBeneficiario = z.object({
  nombre_completo: z.string().trim().min(1),
  municipio: z.string().trim().min(1),
  localidad: z.string().trim().min(1),
  telefono_contacto: z.string().trim().min(1),
  cadena_productiva: z.string().trim().min(1).optional(),
});

app.get("/mis-beneficiarios", async (c) => {
  const tecnico = c.get("tecnico");
  const beneficiarios = await obtenerBeneficiariosTecnico(tecnico.sub);
  return c.json(beneficiarios);
});

app.post("/beneficiarios", zValidator("json", schemaCrearBeneficiario), async (c) => {
  const tecnico = c.get("tecnico");
  const body = c.req.valid("json");

  const beneficiario = await crearBeneficiario(tecnico.sub, {
    nombre: body.nombre_completo,
    municipio: body.municipio,
    localidad: body.localidad,
    telefono: body.telefono_contacto,
    cadena_productiva: body.cadena_productiva,
  });

  return c.json(beneficiario, 201);
});

app.get("/mis-actividades", async (c) => {
  const tecnico = c.get("tecnico");
  const actividades = await obtenerActividadesTecnico(tecnico.sub);
  return c.json(actividades);
});

app.get("/cadenas-productivas", async (c) => {
  const cadenas = await obtenerCadenasProductivas();
  return c.json(cadenas);
});

app.get("/localidades", async (c) => {
  const municipio = c.req.query("municipio");
  const localidades = await obtenerLocalidades(municipio);
  return c.json(localidades);
});

export default app;
