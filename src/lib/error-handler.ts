// @ts-nocheck
import { HTTPException } from "hono/http-exception";
import type { Context, Next } from "hono";

export interface AppError {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export function createError(code: string, message: string, statusCode: number, details?: unknown): AppError {
  return { code, message, statusCode, details };
}

export class ValidationError extends Error {
  code = "VALIDATION_ERROR";
  statusCode = 400;
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

export class NotFoundError extends Error {
  code = "NOT_FOUND";
  statusCode = 404;

  constructor(resource: string) {
    super(`${resource} no encontrado`);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends Error {
  code = "UNAUTHORIZED";
  statusCode = 401;

  constructor(message = "No autenticado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  code = "FORBIDDEN";
  statusCode = 403;

  constructor(message = "Acceso denegado") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends Error {
  code = "CONFLICT";
  statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends Error {
  code = "RATE_LIMITED";
  statusCode = 429;
  details?: { retryAfter?: number };

  constructor(retryAfter?: number) {
    super("Demasiadas solicitudes");
    this.name = "RateLimitError";
    if (retryAfter) {
      this.details = { retryAfter };
    }
  }
}

export class InternalServerError extends Error {
  code = "INTERNAL_ERROR";
  statusCode = 500;

  constructor(message = "Error interno del servidor") {
    super(message);
    this.name = "InternalServerError";
  }
}

function formatErrorResponse(error: unknown): { error: string; code?: string; details?: unknown } {
  if (error instanceof HTTPException) {
    return {
      error: error.message || "Solicitud inválida",
    };
  }

  const err = error as Error & { code?: string; statusCode?: number; details?: unknown };
  
  if (err.code && err.statusCode) {
    return {
      error: err.message,
      code: err.code,
      details: err.details,
    };
  }

  if (err.message) {
    return {
      error: err.message,
    };
  }

  return {
    error: "Error desconocido",
  };
}

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    const response = formatErrorResponse(error);

    if (error instanceof HTTPException) {
      return c.json(response, error.status);
    }

    const err = error as Error & { statusCode?: number | string; code?: string };
    if (err.statusCode) {
      console.error(`[AppError] ${err.code || 'ERROR'}: ${err.message}`);
      const status = typeof err.statusCode === 'number' ? err.statusCode : parseInt(err.statusCode, 10) || 500;
      return c.json(response, status);
    }

    console.error("[UnhandledError]", error);
    return c.json(
      { error: "Error interno del servidor" },
      500
    );
  }
}
