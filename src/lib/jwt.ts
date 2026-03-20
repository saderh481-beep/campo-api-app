import { SignJWT, jwtVerify } from "jose";

if (!process.env.JWT_SECRET) throw new Error("[api-app] JWT_SECRET no configurado");
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export type JwtPayload = {
  sub: string;
  nombre: string;
};

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
