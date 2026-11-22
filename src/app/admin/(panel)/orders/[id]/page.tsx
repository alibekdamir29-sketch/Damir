import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { STATUS_TRANSITIONS } from "@/lib/orders";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, formatPrice } from "@/lib/utils";
import { PageTitle, Panel, Table } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/status-badge";
import { OrderActions } from "@/components/admin/order-actions";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { admin: { include: { user: { select: { email: true } } } } } },
      user: { select: { email: true } },
    },
  });
  if (!order) notFound();
  const paid = order.payments.some((p) => p.status === "SUCCEEDED");
  const allowed = STATUS_TRANSITIONS[order.status].filter((s) => !(s === "PAID" && order.paymentMethod === "ONLINE"));

  return (
    <>
      <PageTitle title={`Заказ ${order.number}`}>
        <StatusBadge status={order.status} />
        <Link href={`/order/${order.publicToken}`} target="_blank" className="text-xs underline">Страница клиента ↗</Link>
      </PageTitle>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Panel title="Товары (снимок на момент покупки)">
            <Table>
              <thead><tr><th>Товар</th><th>Цвет / размер</th><th>Артикул</th><th>Кол-во</th><th className="text-right">Цена</th><th className="text-right">Сумма</th></tr></thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.productId ? <Link href={`/admin/products/${i.productId}`} className="hover:underline">{i.productName}</Link> : i.productName}</td>
                    <td>{i.colorName} / {i.sizeLabel}</td>
                    <td className="text-xs text-neutral-500">{i.variantSku}</td>
                    <td>{i.quantity}</td>
                    <td className="text-right tabular-nums">{formatPrice(i.unitPrice)}</td>
                    <td className="text-right tabular-nums">{formatPrice(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><dt>Товары</dt><dd>{formatPrice(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Доставка</dt><dd>{formatPrice(order.deliveryCost)}</dd></div>
              <div className="flex justify-between border-t pt-1 font-semibold"><dt>Итого</dt><dd>{formatPrice(order.total)}</dd></div>
            </dl>
          </Panel>
          <Panel title="История статусов">
            <ol className="space-y-3 border-l pl-4 text-sm">
              {order.statusHistory.map((h) => (
                <li key={h.id}>
                  <p className="font-medium">{h.fromStatus ? `${ORDER_STATUS_LABELS[h.fromStatus]} → ` : ""}{ORDER_STATUS_LABELS[h.toStatus]}</p>
                  <p className="text-xs text-neutral-500">
                    {h.createdAt.toLocaleString("ru-RU")} · {h.source === "admin" ? h.admin?.user.email ?? "админ" : h.source === "payment" ? "платёжный сервис" : "система"}
                    {h.note && ` · ${h.note}`}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Управление">
            <OrderActions orderId={order.id} allowed={allowed} canConfirmPayment={!paid && order.paymentMethod !== "ONLINE" && order.status !== "CANCELLED"} />
          </Panel>
          <Panel title="Покупатель">
            <p className="text-sm">{order.firstName} {order.lastName}<br /><a href={`tel:${order.phone}`} className="underline">{order.phone}</a>{order.email && <><br />{order.email}</>}</p>
            {order.user && <p className="mt-2 text-xs text-neutral-500">Аккаунт: {order.user.email}</p>}
          </Panel>
          <Panel title="Доставка">
            <p className="text-sm">{order.deliveryMethodName}</p>
            {order.deliveryType === "COURIER" && <p className="text-sm">{order.city}, {order.street}, д. {order.house}{order.apartment && `, кв. ${order.apartment}`}</p>}
            {order.comment && <p className="mt-2 bg-paper-muted p-2 text-sm">«{order.comment}»</p>}
          </Panel>
          <Panel title="Оплата">
            <p className="text-sm">{PAYMENT_METHOD_LABELS[order.paymentMethod]} — <span className={paid ? "text-emerald-700" : "text-amber-700"}>{paid ? "оплачено" : "не оплачено"}</span></p>
            <ul className="mt-3 space-y-1 text-xs text-neutral-500">
              {order.payments.map((p) => (
                <li key={p.id}>{p.provider} · {p.status} · {formatPrice(p.amount)}{p.providerPaymentId && ` · ${p.providerPaymentId}`}{p.paidAt && ` · ${p.paidAt.toLocaleString("ru-RU")}`}</li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
