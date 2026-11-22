import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, cn, formatPrice } from "@/lib/utils";
import { PageTitle, Table } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/status-badge";

export const metadata = { title: "Заказы" };
const STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; paid?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.OrderWhereInput = {};
  if (sp.status && STATUSES.includes(sp.status as OrderStatus)) where.status = sp.status as OrderStatus;
  if (sp.paid) where.payments = { some: { status: "SUCCEEDED" } };
  if (sp.q) where.OR = [{ number: { contains: sp.q, mode: "insensitive" } }, { phone: { contains: sp.q.replace(/[^\d+]/g, "") || sp.q } }, { lastName: { contains: sp.q, mode: "insensitive" } }];
  const [total, orders, counts] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30, include: { payments: { select: { status: true } }, _count: { select: { items: true } } } }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageTitle title="Заказы" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/orders" className={cn("border bg-white px-3 py-1.5 text-xs", !sp.status && !sp.paid && "border-ink")}>Все</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/orders?status=${s}`} className={cn("border bg-white px-3 py-1.5 text-xs", sp.status === s && "border-ink")}>
            {ORDER_STATUS_LABELS[s]} <span className="text-neutral-400">{countOf(s)}</span>
          </Link>
        ))}
      </div>
      <form className="mb-4">
        <input name="q" defaultValue={sp.q} placeholder="Поиск: номер, телефон, фамилия" className="h-10 w-full max-w-sm border bg-white px-3 text-sm" />
      </form>
      <Table>
        <thead><tr><th>№</th><th>Дата</th><th>Клиент</th><th>Телефон</th><th>Позиций</th><th>Оплата</th><th>Статус</th><th className="text-right">Сумма</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td><Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">{o.number}</Link></td>
              <td className="text-neutral-500">{o.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}</td>
              <td>{o.firstName} {o.lastName}</td>
              <td>{o.phone}</td>
              <td>{o._count.items}</td>
              <td>
                <span className="text-xs">{PAYMENT_METHOD_LABELS[o.paymentMethod]}</span>
                <br />
                <span className={cn("text-xs", o.payments.some((p) => p.status === "SUCCEEDED") ? "text-emerald-700" : "text-neutral-500")}>
                  {o.payments.some((p) => p.status === "SUCCEEDED") ? "оплачено" : "не оплачено"}
                </span>
              </td>
              <td><StatusBadge status={o.status} /></td>
              <td className="text-right tabular-nums">{formatPrice(o.total)}</td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={8} className="text-center text-neutral-500">Нет заказов</td></tr>}
        </tbody>
      </Table>
      {total > 30 && (
        <div className="mt-4 flex gap-2 text-sm">
          {page > 1 && <Link href={`?${new URLSearchParams({ ...sp, page: String(page - 1) })}`} className="underline">← Назад</Link>}
          {page * 30 < total && <Link href={`?${new URLSearchParams({ ...sp, page: String(page + 1) })}`} className="underline">Далее →</Link>}
        </div>
      )}
    </>
  );
}
