import { NextResponse } from "next/server";
import { getCartId } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth";
import { AppError, handle } from "@/lib/errors";
import { checkoutSchema } from "@/lib/validation";
import { createOrder } from "@/lib/orders";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const POST = handle(async (req: Request) => {
  const ip = clientIp(req);
  if (!rateLimit(`order:${ip}`, 10, 10 * 60_000).ok) throw new AppError("RATE_LIMIT", "Слишком много заказов за короткое время. Попробуйте позже.", 429);
  const input = checkoutSchema.parse(await req.json());
  const user = await getCurrentUser();
  const result = await createOrder(input, { cartId: await getCartId(), userId: user?.id, ip });
  return NextResponse.json(
    {
      number: result.order.number,
      token: result.order.publicToken,
      status: result.order.status,
      paymentRedirectUrl: result.paymentRedirectUrl,
      duplicate: result.duplicate,
    },
    { status: result.duplicate ? 200 : 201 },
  );
});
