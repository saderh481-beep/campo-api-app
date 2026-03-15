import { SignJWT, jwtVerify } from "jose";
import { env } from "@/config/env";
import type { JWTPayloadApp } from "@/types";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export async function signToken(
  payload: Omit<JWTPayloadApp, "iat" | "exp">,
  expiresIn = "30d"
): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayloadApp> {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as JWTPayloadApp;
}
