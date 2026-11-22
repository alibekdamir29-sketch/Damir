import "server-only";
import { randomBytes } from "crypto";
import { Prisma, type OrderStatus, type PaymentMethod } from "@prisma/client";
import { prisma } from "./db";
import { AppError, notFound } from "./errors";
import { commitSale, releaseStock, reserveStock } from "./inventory";
import { loadCart, type CartView } from "./cart";
import { computeDelivery, getSettings, type StoreSettings } from "./settings";
import { getOnlineProvider } from "./payments";
import type { WebhookEvent } from "./payments/types";
import type { CheckoutInput } from "./validation";
import { audit } from "./audit";

// ───────── Status machine ─────────

export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "PAYMENT_PENDING", "PAID", "PROCESSING", "CANCELLED"],
  CONFIRMED: ["PAYMENT_PENDING", "PAID", "PROCESSING", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "CONFIRMED", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return STATUS_TRANSITIONS[from].includes(to);
}

// ───────── Payment methods ─────────

export function availablePaymentMethods(settings: StoreSettings) {
  const online = getOnlineProvider();
  return {
    CASH_ON_DELIVERY: settings.payments.cashOnDelivery,
    ONLINE: settings.payments.online && !!online,
    BANK_TRANSFER: settings.payments.bankTransfer && settings.payments.bankDetails.length > 0,
    onlineConfiguredInSettings: settings.payments.online,
    onlineProvider: online ? { id: online.id, title: online.title, testMode: online.id === "test" } : null,
  };
}

// ───────── Quote ─────────

export type Quote = {
  cart: CartView;
  subtotal: number;
  delivery: { ok: true; cost: number; methodName: string } | { ok: false; reason: string };
  total: number;
};

export function quoteFrom(cart: CartView, settings: StoreSettings, delivery: { type: "COURIER" | "PICKUP"; city?: string | null }): Quote {
  const subtotal = cart.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const d = computeDelivery(settings, delivery, subtotal);
  return { cart, subtotal, delivery: d, total: subtotal + (d.ok ? d.cost : 0) };
}

// ───────── Create order ─────────

function newPublicToken() {
  return randomBytes(24).toString("base64url");
}

async function nextOrderNumber(tx: Prisma.TransactionClient, year: number) {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO order_counters (year, value) VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE SET value = order_counters.value + 1
    RETURNING value`;
  return `DM-${year}-${String(rows[0].value).padStart(4, "0")}`;
}

export type CreateOrderResult = {
  order: { id: string; number: string; publicToken: string; status: OrderStatus; total: number; paymentMethod: PaymentMethod };
  paymentRedirectUrl: string | null;
  duplicate: boolean;
};

async function findByIdempotencyKey(key: string) {
  return prisma.order.findUnique({
    where: { idempotencyKey: key },
    select: { id: true, number: true, publicToken: true, status: true, total: true, paymentMethod: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
}

export async function createOrder(input: CheckoutInput, ctx: { cartId: string | null; userId?: string | null; ip?: string }): Promise<CreateOrderResult> {
  // 1. Idempotency: repeated submit with the same key returns the same order.
  const existing = await findByIdempotencyKey(input.idempotencyKey);
  if (existing) return { order: existing, paymentRedirectUrl: null, duplicate: true };

  // 2. Re-read cart, prices and stock from the DB. Browser values are never trusted.
  const cart = await loadCart(ctx.cartId);
  if (!cart.id || cart.items.length === 0) throw new AppError("CART_EMPTY", "Корзина пуста", 409);
  const problems = cart.items.filter((i) => i.issue);
  if (problems.length) {
    throw new AppError("CART_CHANGED", "Наличие некоторых товаров изменилось. Проверьте корзину.", 409, {
      items: problems.map((p) => ({ id: p.id, name: p.name, issue: p.issue, available: p.available })),
    });
  }

  const settings = await getSettings();
  const methods = availablePaymentMethods(settings);
  if (!methods[input.paymentMethod]) {
    throw new AppError("PAYMENT_METHOD_UNAVAILABLE", "Выбранный способ оплаты сейчас недоступен", 409);
  }
  if (input.delivery.type === "PICKUP" && input.paymentMethod === "CASH_ON_DELIVERY" && !settings.payments.cashOnDelivery) {
    throw new AppError("PAYMENT_METHOD_UNAVAILABLE", "Выбранный способ оплаты сейчас недоступен", 409);
  }

  const quote = quoteFrom(cart, settings, { type: input.delivery.type, city: input.delivery.city });
  if (!quote.delivery.ok) throw new AppError("DELIVERY_UNAVAILABLE", quote.delivery.reason, 409);
  if (input.expectedTotal != null && input.expectedTotal !== quote.total) {
    throw new AppError("PRICE_CHANGED", "Цены или стоимость доставки изменились. Проверьте итог перед подтверждением.", 409, {
      subtotal: quote.subtotal,
      deliveryCost: quote.delivery.cost,
      total: quote.total,
    });
  }

  const isOnline = input.paymentMethod === "ONLINE";
  const initialStatus: OrderStatus = input.paymentMethod === "CASH_ON_DELIVERY" ? "NEW" : "PAYMENT_PENDING";
  const provider = isOnline ? getOnlineProvider() : null;
  const providerId = isOnline ? provider!.id : input.paymentMethod === "BANK_TRANSFER" ? "bank_transfer" : "cod";

  // 3. One transaction: number, order + snapshot, stock reservation, payment, clear cart.
  let created;
  try {
    created = await prisma.$transaction(
      async (tx) => {
        const number = await nextOrderNumber(tx, new Date().getFullYear());
        const order = await tx.order.create({
          data: {
            number,
            publicToken: newPublicToken(),
            idempotencyKey: input.idempotencyKey,
            userId: ctx.userId ?? null,
            status: initialStatus,
            firstName: input.customer.firstName,
            lastName: input.customer.lastName,
            phone: input.customer.phone,
            email: input.customer.email || null,
            deliveryType: input.delivery.type,
            deliveryMethodName: quote.delivery.ok ? quote.delivery.methodName : "",
            city: input.delivery.type === "COURIER" ? input.delivery.city : null,
            street: input.delivery.type === "COURIER" ? input.delivery.street : null,
            house: input.delivery.type === "COURIER" ? input.delivery.house : null,
            apartment: input.delivery.type === "COURIER" ? input.delivery.apartment || null : null,
            addressLine: input.delivery.addressLine || null,
            comment: input.delivery.comment || null,
            paymentMethod: input.paymentMethod,
            subtotal: quote.subtotal,
            deliveryCost: quote.delivery.ok ? quote.delivery.cost : 0,
            total: quote.total,
            items: {
              create: cart.items.map((i) => ({
                variantId: i.variantId,
                productId: i.productId,
                productName: i.name,
                productSku: i.productSku,
                variantSku: i.sku,
                colorName: i.color.name,
                sizeLabel: i.size.label,
                imageUrl: i.image,
                unitPrice: i.unitPrice,
                quantity: i.quantity,
                lineTotal: i.unitPrice * i.quantity,
              })),
            },
            statusHistory: {
              create: [
                { fromStatus: null, toStatus: "NEW", source: "system", note: "Заказ создан" },
                ...(initialStatus === "PAYMENT_PENDING"
                  ? [{ fromStatus: "NEW" as OrderStatus, toStatus: "PAYMENT_PENDING" as OrderStatus, source: "system", note: "Ожидается оплата" }]
                  : []),
              ],
            },
            payments: { create: { provider: providerId, method: input.paymentMethod, amount: quote.total, status: "PENDING" } },
          },
          include: { payments: true },
        });
        // Sort by variant id to keep a consistent lock order between concurrent orders (no deadlocks).
        for (const item of [...cart.items].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
          await reserveStock(tx, item.variantId, item.quantity, order.id);
          await tx.product.update({ where: { id: item.productId }, data: { popularity: { increment: item.quantity } } });
        }
        await tx.cartItem.deleteMany({ where: { cartId: cart.id! } });
        return order;
      },
      { timeout: 15_000 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const dup = await findByIdempotencyKey(input.idempotencyKey);
      if (dup) return { order: dup, paymentRedirectUrl: null, duplicate: true };
    }
    throw e;
  }

  await audit({ actorId: ctx.userId, action: "order.create", entity: "order", entityId: created.id, meta: { number: created.number, total: created.total }, ip: ctx.ip });

  // 4. Online payment: create a payment session at the provider (outside the DB transaction).
  let paymentRedirectUrl: string | null = null;
  if (isOnline && provider) {
    const payment = created.payments[0];
    try {
      const base = process.env.APP_URL ?? "http://localhost:3000";
      const res = await provider.createPayment({
        paymentId: payment.id,
        orderNumber: created.number,
        amount: created.total,
        currency: created.currency,
        description: `Заказ ${created.number} в DAMIR`,
        customer: { email: created.email, phone: created.phone },
        returnUrl: `${base}/order/${created.publicToken}`,
      });
      await prisma.payment.update({ where: { id: payment.id }, data: { providerPaymentId: res.providerPaymentId } });
      paymentRedirectUrl = res.redirectUrl;
    } catch (e) {
      console.error("[payment.create] failed", e);
      // Order stays PAYMENT_PENDING; the customer can retry payment from the order page.
    }
  }

  return {
    order: { id: created.id, number: created.number, publicToken: created.publicToken, status: created.status, total: created.total, paymentMethod: created.paymentMethod },
    paymentRedirectUrl,
    duplicate: false,
  };
}

/** Retry payment for an unpaid online order (from the order page). */
export async function restartOnlinePayment(publicToken: string) {
  const order = await prisma.order.findUnique({ where: { publicToken }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!order) throw notFound("Заказ");
  if (order.paymentMethod !== "ONLINE" || order.status !== "PAYMENT_PENDING") throw new AppError("NOT_PAYABLE", "Этот заказ не ожидает онлайн-оплаты", 409);
  const provider = getOnlineProvider();
  if (!provider) throw new AppError("PAYMENT_METHOD_UNAVAILABLE", "Онлайн-оплата временно недоступна", 409);
  const payment = await prisma.payment.create({ data: { orderId: order.id, provider: provider.id, method: "ONLINE", amount: order.total, status: "PENDING" } });
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const res = await provider.createPayment({
    paymentId: payment.id,
    orderNumber: order.number,
    amount: order.total,
    currency: order.currency,
    description: `Заказ ${order.number} в DAMIR`,
    customer: { email: order.email, phone: order.phone },
    returnUrl: `${base}/order/${order.publicToken}`,
  });
  await prisma.payment.update({ where: { id: payment.id }, data: { providerPaymentId: res.providerPaymentId } });
  return res.redirectUrl;
}

// ───────── Status changes ─────────

export async function changeOrderStatus(
  orderId: string,
  to: OrderStatus,
  actor: { adminId?: string; source: "admin" | "system" | "payment"; note?: string },
) {
  return prisma.$transaction(async (tx) => {
    // Lock the order row so two admins / webhook + admin cannot apply conflicting changes.
    const locked = await tx.$queryRaw<{ status: OrderStatus }[]>`SELECT status FROM orders WHERE id = ${orderId} FOR UPDATE`;
    if (!locked[0]) throw notFound("Заказ");
    const from = locked[0].status;
    if (from === to) return { from, to, changed: false };
    if (!canTransition(from, to)) throw new AppError("INVALID_TRANSITION", `Нельзя перевести заказ из статуса ${from} в ${to}`, 409);

    const items = await tx.orderItem.findMany({ where: { orderId } });
    if (to === "CANCELLED") {
      for (const i of items) if (i.variantId) await releaseStock(tx, i.variantId, i.quantity, orderId, actor.note ?? "Отмена заказа");
      for (const i of items) if (i.productId) await tx.product.updateMany({ where: { id: i.productId, popularity: { gte: i.quantity } }, data: { popularity: { decrement: i.quantity } } });
      await tx.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "CANCELLED" } });
    }
    if (to === "SHIPPED") {
      for (const i of items) if (i.variantId) await commitSale(tx, i.variantId, i.quantity, orderId);
    }
    if (to === "DELIVERED") {
      // Cash on delivery is collected by the courier: mark the payment as received.
      await tx.payment.updateMany({ where: { orderId, status: "PENDING", method: "CASH_ON_DELIVERY" }, data: { status: "SUCCEEDED", paidAt: new Date() } });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: to } });
    await tx.orderStatusHistory.create({ data: { orderId, fromStatus: from, toStatus: to, note: actor.note, adminId: actor.adminId, source: actor.source } });
    return { from, to, changed: true };
  });
}

/** Admin marks a bank transfer as received (manual reconciliation). */
export async function markPaymentReceived(orderId: string, adminId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
  if (!order) throw notFound("Заказ");
  if (order.paymentMethod === "ONLINE") throw new AppError("ONLINE_PAYMENT", "Онлайн-оплата подтверждается только платёжным провайдером", 409);
  const pending = order.payments.find((p) => p.status === "PENDING");
  if (pending) await prisma.payment.update({ where: { id: pending.id }, data: { status: "SUCCEEDED", paidAt: new Date() } });
  if (canTransition(order.status, "PAID")) await changeOrderStatus(orderId, "PAID", { adminId, source: "admin", note: "Оплата подтверждена администратором" });
}

// ───────── Payment webhook ─────────

export async function applyPaymentEvent(providerId: string, ev: WebhookEvent) {
  const payment = ev.paymentId
    ? await prisma.payment.findUnique({ where: { id: ev.paymentId }, include: { order: true } })
    : ev.providerPaymentId
      ? await prisma.payment.findFirst({ where: { provider: providerId, providerPaymentId: ev.providerPaymentId }, include: { order: true } })
      : null;
  if (!payment || payment.provider !== providerId) throw new AppError("PAYMENT_NOT_FOUND", "Payment not found", 404);
  if (ev.orderNumber && ev.orderNumber !== payment.order.number) throw new AppError("ORDER_MISMATCH", "Order mismatch", 400);

  if (payment.status === "SUCCEEDED") return { ok: true, idempotent: true }; // provider retries are safe

  if (ev.status === "SUCCEEDED") {
    if (ev.amount !== payment.amount) {
      await audit({ action: "payment.amount_mismatch", entity: "payment", entityId: payment.id, meta: { expected: payment.amount, got: ev.amount } });
      throw new AppError("AMOUNT_MISMATCH", "Amount mismatch", 400);
    }
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCEEDED", paidAt: new Date(), rawPayload: ev.raw as Prisma.InputJsonValue, providerPaymentId: ev.providerPaymentId ?? payment.providerPaymentId },
    });
    const order = payment.order;
    if (canTransition(order.status, "PAID")) {
      await changeOrderStatus(order.id, "PAID", { source: "payment", note: `Оплата подтверждена (${providerId})` });
    } else {
      // e.g. order was cancelled while the customer was paying -> needs manual refund
      await audit({ action: "payment.paid_for_closed_order", entity: "order", entityId: order.id, meta: { status: order.status } });
    }
    await audit({ action: "payment.succeeded", entity: "payment", entityId: payment.id, meta: { amount: ev.amount, provider: providerId } });
  } else {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", rawPayload: ev.raw as Prisma.InputJsonValue } });
    await audit({ action: "payment.failed", entity: "payment", entityId: payment.id });
  }
  return { ok: true, idempotent: false };
}

/** Cancels unpaid online orders older than `minutes`, releasing their reserved stock. */
export async function expireUnpaidOrders(minutes = 60) {
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const stale = await prisma.order.findMany({ where: { status: "PAYMENT_PENDING", paymentMethod: "ONLINE", createdAt: { lt: cutoff } }, select: { id: true } });
  let cancelled = 0;
  for (const o of stale) {
    try {
      await changeOrderStatus(o.id, "CANCELLED", { source: "system", note: "Оплата не поступила вовремя" });
      cancelled++;
    } catch (e) {
      console.error("[expire]", o.id, e);
    }
  }
  return { cancelled };
}

// ───────── Tracking ─────────

export const orderPublicSelect = {
  number: true,
  publicToken: true,
  status: true,
  createdAt: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  deliveryType: true,
  deliveryMethodName: true,
  city: true,
  street: true,
  house: true,
  apartment: true,
  comment: true,
  paymentMethod: true,
  subtotal: true,
  deliveryCost: true,
  total: true,
  items: { select: { productName: true, colorName: true, sizeLabel: true, quantity: true, unitPrice: true, lineTotal: true, imageUrl: true } },
  statusHistory: { orderBy: { createdAt: "asc" }, select: { toStatus: true, createdAt: true, note: true } },
  payments: { orderBy: { createdAt: "desc" }, select: { status: true, method: true, paidAt: true } },
} satisfies Prisma.OrderSelect;

export async function getOrderByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return prisma.order.findUnique({ where: { publicToken: token }, select: orderPublicSelect });
}

export async function findOrderByNumberAndPhone(number: string, phone: string) {
  const order = await prisma.order.findUnique({ where: { number }, select: { publicToken: true, phone: true } });
  if (!order || order.phone !== phone) return null; // same response for "not found" and "wrong phone"
  return order.publicToken;
}
