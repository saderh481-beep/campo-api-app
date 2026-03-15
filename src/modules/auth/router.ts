import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "@/middleware/auth";
import { NotFoundError } from "@/lib/errors";
import * as service from "./service";
import { loginSchema } from "./schema";

const router = new Hono();

// POST /auth/login
router.post("/login", zValidator("json", loginSchema), async (c) => {
  const { codigo } = c.req.valid("json");
  const ip         = c.req.header("x-forwarded-for") ?? "unknown";
  const userAgent  = c.req.header("user-agent") ?? "unknown";

  const result = await service.login(codigo, ip, userAgent);
  return c.json(result, 200);
});

// GET /auth/me
router.get("/me", requireAuth, async (c) => {
  const tecnico = await service.me(c.get("jwtPayload").sub);
  if (!tecnico) throw new NotFoundError("Técnico");
  return c.json({ tecnico });
});

export default router;
