import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { getOrderByToken } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, cn, formatPrice } from "@/lib/utils";
import { ProductImage } from "@/components/product/product-image";
import { PayButton } from "@/components/checkout/pay-button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Заказ", robots: { index: false } };

const FLOW = ["NEW", "CONFIRMED", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export default async function OrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> }) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const order = await getOrderByToken(token);
  if (!order) notFound();
  const settings = await getSettings();
  const isNew = sp.new === "1";
  const paid = order.payments.some((p) => p.status === "SUCCEEDED");
  const awaitingOnline = order.paymentMethod === "ONLINE" && order.status === "PAYMENT_PENDING";
  const reached = new Set(order.statusHistory.map((h) => h.toStatus));

  return (
    <div className="container max-w-4xl py-12 md:py-16">
      {isNew && (
        <div className="mb-12 space-y-4 text-center" data-testid="order-success">
          <CheckCircle2 className="mx-auto size-12" strokeWidth={1.2} />
          <h1 className="h-display text-5xl">Спасибо за заказ в DAMIR!</h1>
          <p className="text-lg">
            Ваш заказ <strong data-testid="order-number">№{order.number}</strong> успешно создан.
          </p>
          <p className="text-neutral-600">
            {awaitingOnline ? "Заказ ожидает оплаты. Оплата будет подтверждена автоматически после ответа платёжного сервиса." : "Мы свяжемся с вами для подтверждения деталей."}
          </p>
        </div>
      )}

      <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div>
          <p className="eyebrow mb-2">Заказ</p>
          <p className="font-display text-4xl">№{order.number}</p>
          <p className="mt-1 text-sm text-neutral-500">от {order.createdAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={order.status === "CANCELLED" ? "danger" : order.status === "DELIVERED" ? "success" : "default"} data-testid="order-status">
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
          <Badge variant={paid ? "success" : "warning"}>{paid ? "Оплачено" : "Не оплачено"}</Badge>
        </div>
      </div>

      {awaitingOnline && (
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 bg-paper-muted p-6">
          <p className="text-sm">Заказ ожидает онлайн-оплаты. Если вы закрыли страницу оплаты, можно оплатить снова.</p>
          <PayButton token={order.publicToken} />
        </div>
      )}
      {order.paymentMethod === "BANK_TRANSFER" && !paid && order.status !== "CANCELLED" && settings.payments.bankDetails && (
        <div className="mb-10 space-y-2 bg-paper-muted p-6 text-sm">
          <p className="eyebrow">Реквизиты для оплаты</p>
          <p className="whitespace-pre-line">{settings.payments.bankDetails}</p>
          <p className="text-neutral-500">В назначении платежа укажите номер заказа {order.number}. Статус обновится после подтверждения поступления.</p>
        </div>
      )}

      {order.status !== "CANCELLED" && (
        <ol className="mb-12 grid grid-cols-3 gap-y-6 sm:grid-cols-6" aria-label="Статус заказа">
          {FLOW.map((s) => {
            const done = reached.has(s) || FLOW.indexOf(s) < FLOW.indexOf(order.status as (typeof FLOW)[number]);
            const current = order.status === s;
            return (
              <li key={s} className="flex flex-col items-center gap-2 text-center">
                {done ? <CheckCircle2 className={cn("size-6", current ? "text-ink" : "text-neutral-500")} /> : <Circle className="size-6 text-neutral-300" />}
                <span className={cn("text-[10px] uppercase tracking-[0.14em]", current ? "font-semibold" : "text-neutral-500")}>{ORDER_STATUS_LABELS[s]}</span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="grid gap-12 md:grid-cols-[1fr_280px]">
        <section>
          <p className="eyebrow mb-4">Товары</p>
          <ul className="divide-y border-y">
            {order.items.map((i, idx) => (
              <li key={idx} className="flex gap-4 py-4 text-sm">
                <ProductImage src={i.imageUrl} alt={i.productName} className="aspect-[4/5] w-16 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">{i.productName}</p>
                  <p className="text-neutral-500">{i.colorName} · {i.sizeLabel} · {i.quantity} × {formatPrice(i.unitPrice)}</p>
                </div>
                <p className="tabular-nums">{formatPrice(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt>Товары</dt><dd className="tabular-nums">{formatPrice(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Доставка</dt><dd className="tabular-nums">{order.deliveryCost ? formatPrice(order.deliveryCost) : "Бесплатно"}</dd></div>
            <div className="flex justify-between border-t pt-3 text-base font-semibold"><dt>Итого</dt><dd className="tabular-nums">{formatPrice(order.total)}</dd></div>
          </dl>
        </section>
        <aside className="space-y-8 text-sm">
          <div>
            <p className="eyebrow mb-2">Получатель</p>
            <p>{order.firstName} {order.lastName}<br />{order.phone}</p>
          </div>
          <div>
            <p className="eyebrow mb-2">Доставка</p>
            <p>{order.deliveryMethodName}</p>
            {order.deliveryType === "COURIER" && <p className="text-neutral-600">{order.city}, {order.street}, д. {order.house}{order.apartment && `, кв. ${order.apartment}`}</p>}
          </div>
          <div>
            <p className="eyebrow mb-2">Оплата</p>
            <p>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
          </div>
          <div>
            <p className="eyebrow mb-3">История</p>
            <ol className="space-y-3 border-l pl-4" data-testid="status-history">
              {order.statusHistory.map((h, i) => (
                <li key={i}>
                  <p className="font-medium">{ORDER_STATUS_LABELS[h.toStatus]}</p>
                  <p className="flex items-center gap-1 text-xs text-neutral-500"><Clock className="size-3" />{h.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}</p>
                  {h.note && <p className="text-xs text-neutral-500">{h.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>

      <p className="mt-12 text-center text-xs text-neutral-500">
        Сохраните эту ссылку, чтобы отслеживать заказ. Или используйте <Link href="/track" className="underline">страницу отслеживания</Link> с номером заказа и телефоном.
      </p>
    </div>
  );
}
