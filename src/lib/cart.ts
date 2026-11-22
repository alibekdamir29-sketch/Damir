import "server-only";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { AppError, notFound } from "./errors";
import { CART_COOKIE, cookieOptions, signCartId, verifyCartToken } from "./session";
import { available } from "./catalog";

const MAX_QTY_PER_LINE = 20;

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      variant: {
        include: {
          inventory: true,
          color: true,
          size: true,
          product: {
            include: {
              images: { orderBy: { sortOrder: "asc" }, take: 1 },
              colors: { orderBy: { sortOrder: "asc" } },
              sizes: { orderBy: { sortOrder: "asc" } },
              variants: { where: { isActive: true }, include: { inventory: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

/** Reads the cart id from the signed cookie (no writes). */
export async function getCartId(): Promise<string | null> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  const id = await verifyCartToken(token);
  if (!id) return null;
  const exists = await prisma.cart.findUnique({ where: { id }, select: { id: true } });
  return exists?.id ?? null;
}

/** Returns existing cart id or creates a new cart and sets the cookie (route handlers / actions only). */
export async function getOrCreateCartId(userId?: string | null): Promise<string> {
  const existing = await getCartId();
  if (existing) {
    if (userId) await prisma.cart.updateMany({ where: { id: existing, userId: null }, data: { userId } });
    return existing;
  }
  const cart = await prisma.cart.create({ data: { userId: userId ?? null } });
  await setCartCookie(cart.id);
  return cart.id;
}

export async function setCartCookie(cartId: string) {
  (await cookies()).set(CART_COOKIE, await signCartId(cartId), { ...cookieOptions, maxAge: 60 * 60 * 24 * 60 });
}

export function buildCartView(cart: CartWithItems | null) {
  const items = (cart?.items ?? []).map((item) => {
    const v = item.variant;
    const p = v.product;
    const avail = v.isActive && p.isActive ? available(v.inventory) : 0;
    const issue =
      !p.isActive || !v.isActive
        ? "UNAVAILABLE"
        : avail === 0
          ? "OUT_OF_STOCK"
          : avail < item.quantity
            ? "INSUFFICIENT_STOCK"
            : null;
    return {
      id: item.id,
      variantId: v.id,
      productId: p.id,
      slug: p.slug,
      name: p.name,
      sku: v.sku,
      productSku: p.sku,
      image: p.images[0]?.url ?? null,
      color: { id: v.color.id, name: v.color.name, hex: v.color.hex },
      size: { id: v.size.id, label: v.size.label },
      unitPrice: p.price,
      oldPrice: p.oldPrice,
      quantity: item.quantity,
      lineTotal: p.price * item.quantity,
      available: avail,
      issue,
      // options for switching colour / size inside the cart
      options: {
        colors: p.colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex })),
        sizes: p.sizes.map((s) => ({ id: s.id, label: s.label })),
        variants: p.variants.map((pv) => ({ id: pv.id, colorId: pv.colorId, sizeId: pv.sizeId, available: available(pv.inventory) })),
      },
    };
  });
  const subtotal = items.filter((i) => !i.issue || i.issue === "INSUFFICIENT_STOCK").reduce((s, i) => s + i.lineTotal, 0);
  return {
    id: cart?.id ?? null,
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal,
    hasIssues: items.some((i) => i.issue),
  };
}
export type CartView = ReturnType<typeof buildCartView>;

export async function loadCart(cartId: string | null) {
  if (!cartId) return buildCartView(null);
  const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: cartInclude });
  return buildCartView(cart);
}

async function loadVariantForSale(variantId: string) {
  const v = await prisma.productVariant.findUnique({ where: { id: variantId }, include: { inventory: true, product: { select: { isActive: true, id: true } } } });
  if (!v || !v.isActive || !v.product.isActive) throw new AppError("VARIANT_UNAVAILABLE", "Этот вариант товара недоступен", 409);
  return v;
}

export async function addItem(cartId: string, variantId: string, quantity: number) {
  const v = await loadVariantForSale(variantId);
  const existing = await prisma.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId } } });
  const newQty = (existing?.quantity ?? 0) + quantity;
  const avail = available(v.inventory);
  if (avail <= 0) throw new AppError("OUT_OF_STOCK", "Этого размера/цвета нет в наличии", 409, { available: 0 });
  if (newQty > avail) throw new AppError("INSUFFICIENT_STOCK", `В наличии только ${avail} шт.`, 409, { available: avail });
  if (newQty > MAX_QTY_PER_LINE) throw new AppError("QTY_LIMIT", `Не более ${MAX_QTY_PER_LINE} шт. одной позиции`, 409);
  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    create: { cartId, variantId, quantity },
    update: { quantity: newQty },
  });
}

export async function updateItem(cartId: string, itemId: string, patch: { quantity?: number; variantId?: string }) {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId }, include: { variant: true } });
  if (!item) throw notFound("Товар в корзине");
  const targetVariantId = patch.variantId ?? item.variantId;
  const qty = patch.quantity ?? item.quantity;
  const v = await loadVariantForSale(targetVariantId);
  if (v.productId !== item.variant.productId) throw new AppError("INVALID_VARIANT", "Можно выбрать только размер или цвет этого же товара", 422);
  const avail = available(v.inventory);

  if (targetVariantId !== item.variantId) {
    const other = await prisma.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId: targetVariantId } } });
    const merged = qty + (other?.quantity ?? 0);
    if (avail <= 0) throw new AppError("OUT_OF_STOCK", "Этого размера/цвета нет в наличии", 409, { available: 0 });
    if (merged > avail) throw new AppError("INSUFFICIENT_STOCK", `В наличии только ${avail} шт.`, 409, { available: avail });
    await prisma.$transaction([
      prisma.cartItem.delete({ where: { id: item.id } }),
      prisma.cartItem.upsert({
        where: { cartId_variantId: { cartId, variantId: targetVariantId } },
        create: { cartId, variantId: targetVariantId, quantity: qty },
        update: { quantity: Math.min(merged, MAX_QTY_PER_LINE) },
      }),
    ]);
    return;
  }
  if (qty > avail) throw new AppError("INSUFFICIENT_STOCK", `В наличии только ${avail} шт.`, 409, { available: avail });
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: qty } });
}

export async function removeItem(cartId: string, itemId: string) {
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
}

/** On login: move guest-cart items into the user's most recent cart. */
export async function attachCartToUser(userId: string) {
  const guestId = await getCartId();
  const userCart = await prisma.cart.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
  if (!guestId) {
    if (userCart) await setCartCookie(userCart.id);
    return;
  }
  if (!userCart || userCart.id === guestId) {
    await prisma.cart.update({ where: { id: guestId }, data: { userId } });
    return;
  }
  const guestItems = await prisma.cartItem.findMany({ where: { cartId: guestId } });
  await prisma.$transaction(async (tx) => {
    for (const gi of guestItems) {
      const ex = await tx.cartItem.findUnique({ where: { cartId_variantId: { cartId: userCart.id, variantId: gi.variantId } } });
      if (ex) await tx.cartItem.update({ where: { id: ex.id }, data: { quantity: Math.min(MAX_QTY_PER_LINE, ex.quantity + gi.quantity) } });
      else await tx.cartItem.create({ data: { cartId: userCart.id, variantId: gi.variantId, quantity: gi.quantity } });
    }
    await tx.cart.delete({ where: { id: guestId } });
  });
  await setCartCookie(userCart.id);
}
