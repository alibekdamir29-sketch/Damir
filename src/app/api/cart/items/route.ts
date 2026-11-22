import { NextResponse } from "next/server";
import { addItem, getOrCreateCartId, loadCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { addToCartSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const POST = handle(async (req: Request) => {
  if (!rateLimit(`cart:${clientIp(req)}`, 60, 60_000).ok) return NextResponse.json({ error: { code: "RATE_LIMIT", message: "Слишком много запросов" } }, { status: 429 });
  const body = addToCartSchema.parse(await req.json());
  const user = await getCurrentUser();
  const cartId = await getOrCreateCartId(user?.id);
  await addItem(cartId, body.variantId, body.quantity);
  return NextResponse.json(await loadCart(cartId));
});
