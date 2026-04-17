import { SignJWT, jwtVerify, TokenExpiredError, JSONWebTokenError } from "jose";
import { requireEnv } from "@/config/env";

function getSecret() {
  const jwtSecret = requireEnv("JWT_SECRET", { minLength: 32 });
  return new TextEncoder().encode(jwtSecret);
}

function getEndOfMonth(): Date {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const hoursUntilEnd = (endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60);
  const maxHours = Math.min(24, hoursUntilEnd);
  return new Date(now.getTime() + maxHours * 60 * 60 * 1000);
}

export type JwtPayload = {
  sub: string;
  nombre: string;
  rol?: string;
};

export async function signJwt(payload: JwtPayload): Promise<string> {
  const expires = getEndOfMonth();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(getSecret());
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {\n    const { payload } = await jwtVerify(token, getSecret());\n    console.log(`[JWT] Verified successfully for sub: ${(payload as any).sub?.slice(0,8)}...`);\n    return payload as unknown as JwtPayload;\n  } catch (error) {\n    const tokenPreview = token.slice(0, 20) + '...';\n    if (error instanceof TokenExpiredError) {\n      console.error(`[JWT] Token expired: ${tokenPreview}`, error.message);\n    } else if (error instanceof JSONWebTokenError) {\n      console.error(`[JWT] Invalid token (sig/content): ${tokenPreview}`, error.message);\n    } else {\n      console.error(`[JWT] Verify error: ${tokenPreview}`, error);\n    }\n    return null;\n  }
}
