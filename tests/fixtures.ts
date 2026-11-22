import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/settings";

export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    ai_messages, ai_conversations, payments, order_status_history, inventory_movements, order_items, orders, order_counters,
    cart_items, carts, inventory, product_variants, product_images, product_colors, product_sizes, products, categories,
    store_settings, audit_logs, addresses, admins, users CASCADE`);
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) await prisma.storeSetting.create({ data: { key, value } });
}

let n = 0;
/** Product with one colour and given sizes, each variant with `stock` units. */
export async function makeProduct(opts: { price?: number; oldPrice?: number; stock?: Record<string, number>; name?: string; color?: string } = {}) {
  n++;
  const cat = await prisma.category.upsert({ where: { slug: "hoodies" }, create: { slug: "hoodies", name: "Hoodies" }, update: {} });
  const stock = opts.stock ?? { M: 5 };
  const p = await prisma.product.create({
    data: {
      sku: `T-${n}-${randomUUID().slice(0, 6)}`.toUpperCase(),
      slug: `test-product-${n}-${randomUUID().slice(0, 6)}`,
      name: opts.name ?? `Test Hoodie ${n}`,
      description: "Test product description",
      categoryId: cat.id,
      price: opts.price ?? 10000,
      oldPrice: opts.oldPrice,
      colors: { create: [{ name: opts.color ?? "Чёрный", hex: "#111111" }] },
      sizes: { create: Object.keys(stock).map((label, i) => ({ label, sortOrder: i })) },
    },
    include: { colors: true, sizes: true },
  });
  const variants: Record<string, string> = {};
  for (const s of p.sizes) {
    const v = await prisma.productVariant.create({
      data: { productId: p.id, colorId: p.colors[0].id, sizeId: s.id, sku: `${p.sku}-${s.label}`, inventory: { create: { quantity: stock[s.label] } } },
    });
    variants[s.label] = v.id;
  }
  return { product: p, variants };
}

export async function makeCart(items: { variantId: string; quantity: number }[]) {
  return prisma.cart.create({ data: { items: { create: items } } });
}

export function checkoutInput(over: Partial<Record<string, unknown>> = {}) {
  return {
    idempotencyKey: randomUUID(),
    customer: { firstName: "Айдана", lastName: "Серикова", phone: "+77011234567", email: "" },
    delivery: { type: "COURIER" as const, city: "Алматы", street: "Абая", house: "10", apartment: "5", comment: "" },
    paymentMethod: "CASH_ON_DELIVERY" as const,
    ...over,
  };
}

export async function inv(variantId: string) {
  return prisma.inventory.findUniqueOrThrow({ where: { variantId } });
}
