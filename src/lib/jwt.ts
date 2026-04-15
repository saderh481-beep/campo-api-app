import { SignJWT, jwtVerify } from "jose";
import { requireEnv } from "@/config/env";

function getSecret() {
  const jwtSecret = requireEnv("JWT_SECRET", { minLength: 32 });
  return new TextEncoder().encode(jwtSecret);
}

export type JwtPayload = {
  sub: string;
  nombre: string;
  rol?: string;
};

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
