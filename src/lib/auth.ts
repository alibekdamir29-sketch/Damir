import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { AppError, forbidden, unauthorized } from "./errors";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, cookieOptions, signSession, verifySession } from "./session";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function startSession(user: { id: string; role: "USER" | "ADMIN" }) {
  const token = await signSession({ sub: user.id, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_SECONDS });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Current user from the session cookie, re-validated against the DB (role/active can change). */
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, isActive: true, admin: { select: { id: true } } },
  });
  if (!user || !user.isActive) return null;
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/** Admin = role ADMIN + row in admins table. Checked server-side on every admin API call. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (user.role !== "ADMIN" || !user.admin) throw forbidden();
  return { ...user, adminId: user.admin.id };
}

export async function getAdminOrNull() {
  try {
    return await requireAdmin();
  } catch (e) {
    if (e instanceof AppError) return null;
    throw e;
  }
}
