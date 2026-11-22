import { NextResponse } from "next/server";
import { getCartId, loadCart, removeItem, updateItem } from "@/lib/cart";
import { AppError, handle } from "@/lib/errors";
import { updateCartItemSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const cartId = await getCartId();
  if (!cartId) throw new AppError("CART_EMPTY", "Корзина пуста", 404);
  await updateItem(cartId, id, updateCartItemSchema.parse(await req.json()));
  return NextResponse.json(await loadCart(cartId));
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const cartId = await getCartId();
  if (cartId) await removeItem(cartId, id);
  return NextResponse.json(await loadCart(cartId));
});
