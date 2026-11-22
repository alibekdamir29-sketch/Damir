import { NextResponse } from "next/server";
import { z } from "zod";
import { getCartId, loadCart } from "@/lib/cart";
import { handle } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { availablePaymentMethods, quoteFrom } from "@/lib/orders";

const schema = z.object({ type: z.enum(["COURIER", "PICKUP"]), city: z.string().trim().max(60).optional() });

/** Server-side totals for the checkout page (prices + delivery from DB/settings). */
export const POST = handle(async (req: Request) => {
  const body = schema.parse(await req.json());
  const [cart, settings] = await Promise.all([loadCart(await getCartId()), getSettings()]);
  const q = quoteFrom(cart, settings, body);
  return NextResponse.json({
    cart: q.cart,
    subtotal: q.subtotal,
    delivery: q.delivery,
    total: q.total,
    paymentMethods: availablePaymentMethods(settings),
  });
});
