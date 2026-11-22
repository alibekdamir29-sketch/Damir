import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startSession, verifyPassword } from "@/lib/auth";
import { attachCartToUser } from "@/lib/cart";
import { AppError, handle } from "@/lib/errors";
import { loginSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

// Constant-time-ish failure path: compare against a dummy hash when the user does not exist.
import bcrypt from "bcryptjs";
const DUMMY_HASH = bcrypt.hashSync("damir-dummy-password", 12);

export const POST = handle(async (req: Request) => {
  const ip = clientIp(req);
  const body = loginSchema.parse(await req.json());
  if (!rateLimit(`login:${ip}`, 20, 15 * 60_000).ok || !rateLimit(`login:${body.email}`, 8, 15 * 60_000).ok) {
    throw new AppError("RATE_LIMIT", "Слишком много попыток входа. Подождите 15 минут.", 429);
  }
  const user = await prisma.user.findUnique({ where: { email: body.email }, include: { admin: true } });
  const ok = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.isActive) {
    await audit({ action: "auth.login_failed", meta: { email: body.email }, ip });
    throw new AppError("INVALID_CREDENTIALS", "Неверный email или пароль", 401);
  }
  const role = user.role === "ADMIN" && user.admin ? "ADMIN" : "USER";
  await startSession({ id: user.id, role });
  if (role === "ADMIN") await prisma.admin.update({ where: { userId: user.id }, data: { lastLoginAt: new Date() } });
  await attachCartToUser(user.id);
  await audit({ actorId: user.id, action: role === "ADMIN" ? "auth.admin_login" : "auth.login", ip });
  return NextResponse.json({ user: { id: user.id, email: user.email, firstName: user.firstName, role } });
});
