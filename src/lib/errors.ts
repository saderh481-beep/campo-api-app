import type { Context } from "hono";

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) { super(`${resource} no encontrado`, 404); }
}

export class UnauthorizedError extends AppError {
  constructor(msg = "No autenticado") { super(msg, 401); }
}

export class ConflictError extends AppError {
  constructor(msg: string) { super(msg, 409); }
}

export function handleError(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(
      { error: err.message, ...(err.details ? { details: err.details } : {}) },
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 500
    );
  }
  if ("code" in err) {
    const pg = err as { code: string; detail?: string };
    if (pg.code === "23505") return c.json({ error: "Registro duplicado", details: pg.detail }, 409);
    if (pg.code === "23503") return c.json({ error: "Referencia inválida", details: pg.detail }, 400);
  }
  console.error("[Error]", err);
  return c.json({ error: "Error interno del servidor" }, 500);
}
