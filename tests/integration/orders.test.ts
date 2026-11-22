import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { changeOrderStatus, createOrder, applyPaymentEvent, markPaymentReceived, expireUnpaidOrders } from "@/lib/orders";
import { addItem, loadCart, updateItem } from "@/lib/cart";
import { adjustStock } from "@/lib/inventory";
import { AppError } from "@/lib/errors";
import { checkoutInput, inv, makeCart, makeProduct, resetDb } from "../fixtures";

beforeEach(resetDb);

describe("cart", () => {
  it("refuses to add more than available or an out-of-stock size", async () => {
    const { variants } = await makeProduct({ stock: { M: 2, L: 0 } });
    const cart = await makeCart([]);
    await addItem(cart.id, variants.M, 2);
    await expect(addItem(cart.id, variants.M, 1)).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    await expect(addItem(cart.id, variants.L, 1)).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
  });

  it("switches size inside the cart only to an in-stock variant of the same product", async () => {
    const { variants } = await makeProduct({ stock: { M: 3, L: 1, XL: 0 } });
    const other = await makeProduct({ stock: { M: 3 } });
    const cart = await makeCart([{ variantId: variants.M, quantity: 1 }]);
    const item = (await loadCart(cart.id)).items[0];
    await expect(updateItem(cart.id, item.id, { variantId: variants.XL })).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    await expect(updateItem(cart.id, item.id, { variantId: other.variants.M })).rejects.toMatchObject({ code: "INVALID_VARIANT" });
    await updateItem(cart.id, item.id, { variantId: variants.L });
    expect((await loadCart(cart.id)).items[0].size.label).toBe("L");
  });

  it("uses DB prices, not client values, and flags stock changes", async () => {
    const { product, variants } = await makeProduct({ price: 15000, stock: { M: 5 } });
    const cart = await makeCart([{ variantId: variants.M, quantity: 3 }]);
    await prisma.product.update({ where: { id: product.id }, data: { price: 12000 } });
    await prisma.inventory.update({ where: { variantId: variants.M }, data: { quantity: 2 } });
    const view = await loadCart(cart.id);
    expect(view.items[0].unitPrice).toBe(12000);
    expect(view.items[0].issue).toBe("INSUFFICIENT_STOCK");
  });
});

describe("order creation", () => {
  it("creates an order with number, snapshot, reservation, history and clears the cart", async () => {
    const { product, variants } = await makeProduct({ price: 20000, stock: { M: 5 } });
    const cart = await makeCart([{ variantId: variants.M, quantity: 2 }]);
    const res = await createOrder(checkoutInput() as never, { cartId: cart.id });
    expect(res.order.number).toMatch(/^DM-\d{4}-0001$/);
    expect(res.order.total).toBe(40000 + 1500);
    expect(res.order.status).toBe("NEW");
    expect(await inv(variants.M)).toMatchObject({ quantity: 5, reserved: 2 });
    expect(await prisma.cartItem.count({ where: { cartId: cart.id } })).toBe(0);

    // catalogue change does not affect the stored order
    await prisma.product.update({ where: { id: product.id }, data: { name: "Renamed", price: 1 } });
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: res.order.id } });
    expect(item).toMatchObject({ productName: product.name, unitPrice: 20000, sizeLabel: "M", colorName: "Чёрный", quantity: 2 });
    expect(await prisma.orderStatusHistory.count({ where: { orderId: res.order.id } })).toBe(1);

    const second = await createOrder(checkoutInput() as never, { cartId: (await makeCart([{ variantId: variants.M, quantity: 1 }])).id });
    expect(second.order.number).toMatch(/-0002$/);
  });

  it("is idempotent: the same key returns the same order", async () => {
    const { variants } = await makeProduct({ stock: { M: 5 } });
    const cart = await makeCart([{ variantId: variants.M, quantity: 1 }]);
    const input = checkoutInput();
    const a = await createOrder(input as never, { cartId: cart.id });
    const b = await createOrder(input as never, { cartId: cart.id });
    expect(b.duplicate).toBe(true);
    expect(b.order.id).toBe(a.order.id);
    expect(await prisma.order.count()).toBe(1);
    expect((await inv(variants.M)).reserved).toBe(1);
  });

  it("never sells the last unit twice under concurrency", async () => {
    const { variants } = await makeProduct({ stock: { M: 1 } });
    const carts = await Promise.all(Array.from({ length: 5 }, () => makeCart([{ variantId: variants.M, quantity: 1 }])));
    const results = await Promise.allSettled(carts.map((c) => createOrder(checkoutInput() as never, { cartId: c.id })));
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(4);
    for (const f of failed) expect(f.reason).toBeInstanceOf(AppError);
    expect(await inv(variants.M)).toMatchObject({ quantity: 1, reserved: 1 });
    expect(await prisma.order.count()).toBe(1);
  });

  it("rejects when the total the customer saw has changed", async () => {
    const { variants } = await makeProduct({ price: 10000, stock: { M: 5 } });
    const cart = await makeCart([{ variantId: variants.M, quantity: 1 }]);
    await expect(createOrder(checkoutInput({ expectedTotal: 5 }) as never, { cartId: cart.id })).rejects.toMatchObject({ code: "PRICE_CHANGED" });
    expect(await prisma.order.count()).toBe(0);
  });

  it("rejects empty carts, out-of-stock carts and unknown cities", async () => {
    await expect(createOrder(checkoutInput() as never, { cartId: (await makeCart([])).id })).rejects.toMatchObject({ code: "CART_EMPTY" });
    const { variants } = await makeProduct({ stock: { M: 1 } });
    const cart = await makeCart([{ variantId: variants.M, quantity: 1 }]);
    await expect(
      createOrder(checkoutInput({ delivery: { type: "COURIER", city: "Нигде", street: "x", house: "1" } }) as never, { cartId: cart.id }),
    ).rejects.toMatchObject({ code: "DELIVERY_UNAVAILABLE" });
    await prisma.inventory.update({ where: { variantId: variants.M }, data: { quantity: 0 } });
    await expect(createOrder(checkoutInput() as never, { cartId: cart.id })).rejects.toMatchObject({ code: "CART_CHANGED" });
  });

  it("free shipping and pickup are computed on the server", async () => {
    const { variants } = await makeProduct({ price: 60000, stock: { M: 5 } });
    const a = await createOrder(checkoutInput() as never, { cartId: (await makeCart([{ variantId: variants.M, quantity: 1 }])).id });
    expect(a.order.total).toBe(60000);
    const b = await createOrder(checkoutInput({ delivery: { type: "PICKUP" } }) as never, { cartId: (await makeCart([{ variantId: variants.M, quantity: 1 }])).id });
    expect(b.order.total).toBe(60000);
  });
});

describe("status changes & inventory", () => {
  it("cancel releases reservation; ship deducts stock; history is recorded", async () => {
    const { variants } = await makeProduct({ stock: { M: 5 } });
    const o1 = await createOrder(checkoutInput() as never, { cartId: (await makeCart([{ variantId: variants.M, quantity: 2 }])).id });
    await changeOrderStatus(o1.order.id, "CANCELLED", { source: "admin" });
    expect(await inv(variants.M)).toMatchObject({ quantity: 5, reserved: 0 });

    const o2 = await createOrder(checkoutInput() as never, { cartId: (await makeCart([{ variantId: variants.M, quantity: 3 }])).id });
    for (const s of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const) await changeOrderStatus(o2.order.id, s, { source: "admin" });
    expect(await inv(variants.M)).toMatchObject({ quantity: 2, reserved: 0 });
    const hist = await prisma.orderStatusHistory.findMany({ where: { orderId: o2.order.id }, orderBy: { createdAt: "asc" } });
    expect(hist.map((h) => h.toStatus)).toEqual(["NEW", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]);
    // COD is marked paid on delivery
    expect((await prisma.payment.findFirstOrThrow({ where: { orderId: o2.order.id } })).status).toBe("SUCCEEDED");
    const moves = await prisma.inventoryMovement.findMany({ where: { variantId: variants.M } });
    expect(moves.map((m) => m.type).sort()).toEqual(["RELEASE", "RESERVE", "RESERVE", "SALE"]);
  });

  it("rejects invalid transitions", async () => {
    const { variants } = await makeProduct({ stock: { M: 5 } });
    const o = await createOrder(checkoutInput() as never, { cartId: (await makeCart([{ variantId: variants.M, quantity: 1 }])).id });
    await expect(changeOrderStatus(o.order.id, "DELIVERED", { source: "admin" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("admin stock changes never go negative or below reserved and are logged", async () => {
    const { variants } = await makeProduct({ stock: { M: 5 } });
    const admin = await prisma.admin.create({ data: { user: { create: { email: "a@x.kz", passwordHash: "x", firstName: "A", role: "ADMIN" } } } });
    await createOrder(checkoutInput() as never, { cartId: (await makeCart([{ variantId: variants.M, quantity: 3 }])).id });
    await expect(adjustStock({ variantId: variants.M, adminId: admin.id, set: -1 })).rejects.toMatchObject({ code: "NEGATIVE_STOCK" });
    await expect(adjustStock({ variantId: variants.M, adminId: admin.id, set: 2 })).rejects.toMatchObject({ code: "BELOW_RESERVED" });
    await adjustStock({ variantId: variants.M, adminId: admin.id, delta: 10, reason: "Поставка" });
    expect(await inv(variants.M)).toMatchObject({ quantity: 15, reserved: 3 });
    const last = await prisma.inventoryMovement.findFirstOrThrow({ where: { variantId: variants.M, type: "RESTOCK" } });
    expect(last).toMatchObject({ quantityDelta: 10, quantityAfter: 15, adminId: admin.id });
    // DB constraint is the last line of defence
    await expect(prisma.inventory.update({ where: { variantId: variants.M }, data: { reserved: 999 } })).rejects.toThrow();
  });
});

describe("payments", () => {
  async function onlineOrder() {
    const { variants } = await makeProduct({ price: 10000, stock: { M: 5 } });
    const o = await createOrder(checkoutInput({ paymentMethod: "ONLINE" }) as never, { cartId: (await makeCart([{ variantId: variants.M, quantity: 1 }])).id });
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: o.order.id } });
    return { o, payment, variants };
  }

  it("online order waits for payment and gets a provider redirect", async () => {
    const { o } = await onlineOrder();
    expect(o.order.status).toBe("PAYMENT_PENDING");
    expect(o.paymentRedirectUrl).toContain("/pay/test/");
  });

  it("only a matching webhook marks it PAID, and retries are idempotent", async () => {
    const { o, payment } = await onlineOrder();
    await expect(applyPaymentEvent("test", { paymentId: payment.id, status: "SUCCEEDED", amount: 1, raw: {} })).rejects.toMatchObject({ code: "AMOUNT_MISMATCH" });
    await expect(applyPaymentEvent("cloudpayments", { paymentId: payment.id, status: "SUCCEEDED", amount: payment.amount, raw: {} })).rejects.toMatchObject({ code: "PAYMENT_NOT_FOUND" });
    await applyPaymentEvent("test", { paymentId: payment.id, status: "SUCCEEDED", amount: payment.amount, raw: {} });
    const r = await applyPaymentEvent("test", { paymentId: payment.id, status: "SUCCEEDED", amount: payment.amount, raw: {} });
    expect(r.idempotent).toBe(true);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.order.id } })).status).toBe("PAID");
  });

  it("admin cannot manually confirm online payments; unpaid online orders expire and release stock", async () => {
    const { o, variants } = await onlineOrder();
    await expect(markPaymentReceived(o.order.id, "x")).rejects.toMatchObject({ code: "ONLINE_PAYMENT" });
    await prisma.order.update({ where: { id: o.order.id }, data: { createdAt: new Date(Date.now() - 2 * 3600_000) } });
    expect(await expireUnpaidOrders(60)).toEqual({ cancelled: 1 });
    expect(await inv(variants.M)).toMatchObject({ reserved: 0 });
  });
});
