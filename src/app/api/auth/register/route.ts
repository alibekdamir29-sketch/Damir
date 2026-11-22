import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, startSession } from "@/lib/auth";
import { attachCartToUser } from "@/lib/cart";
import { AppError, handle } from "@/lib/errors";
import { registerSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const POST = handle(async (req: Request) => {
  const ip = clientIp(req);
  if (!rateLimit(`register:${ip}`, 10, 60 * 60_000).ok) throw new AppError("RATE_LIMIT", "Слишком много попыток. Попробуйте позже.", 429);
  const data = registerSchema.parse(await req.json());
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new AppError("EMAIL_TAKEN", "Пользователь с таким email уже зарегистрирован", 409);
  const user = await prisma.user.create({
    data: { email: data.email, passwordHash: await hashPassword(data.password), firstName: data.firstName, lastName: data.lastName, phone: data.phone, role: "USER" },
  });
  await startSession({ id: user.id, role: "USER" });
  await attachCartToUser(user.id);
  await audit({ actorId: user.id, action: "user.register", entity: "user", entityId: user.id, ip });
  return NextResponse.json({ user: { id: user.id, email: user.email, firstName: user.firstName } }, { status: 201 });
});
