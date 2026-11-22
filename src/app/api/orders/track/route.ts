import { NextResponse } from "next/server";
import { AppError, handle } from "@/lib/errors";
import { trackSchema } from "@/lib/validation";
import { findOrderByNumberAndPhone } from "@/lib/orders";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const POST = handle(async (req: Request) => {
  if (!rateLimit(`track:${clientIp(req)}`, 20, 10 * 60_000).ok) throw new AppError("RATE_LIMIT", "Слишком много попыток. Попробуйте позже.", 429);
  const { number, phone } = trackSchema.parse(await req.json());
  const token = await findOrderByNumberAndPhone(number, phone);
  if (!token) throw new AppError("NOT_FOUND", "Заказ с таким номером и телефоном не найден", 404);
  return NextResponse.json({ token });
});
