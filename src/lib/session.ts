// Edge-safe JWT helpers (used by middleware and server code).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "damir_session";
export const CART_COOKIE = "damir_cart";
export const AI_COOKIE = "damir_ai";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = { sub: string; role: "USER" | "ADMIN" };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (min 32 chars)");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .setAudience("damir:session")
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: "damir:session" });
    if (!payload.sub || (payload.role !== "USER" && payload.role !== "ADMIN")) return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export async function signCartId(cartId: string): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(cartId).setAudience("damir:cart").sign(secret());
}

export async function verifyCartToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: "damir:cart" });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** Generic signed id (e.g. AI conversation id) so clients cannot read other people's data by guessing ids. */
export async function signId(aud: string, id: string): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(id).setAudience(`damir:${aud}`).sign(secret());
}

export async function verifyId(aud: string, token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: `damir:${aud}` });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
