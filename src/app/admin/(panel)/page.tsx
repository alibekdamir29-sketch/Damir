import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { PageTitle, Panel, Table } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/status-badge";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const since30 = new Date(Date.now() - 30 * 86400_000);
  const [products, activeProducts, orders, newOrders, paidOrders, revenue, revenue30, lowStock, popular, recent] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "NEW" } }),
    prisma.order.count({ where: { payments: { some: { status: "SUCCEEDED" } } } }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED", paidAt: { gte: since30 } }, _sum: { amount: true } }),
    prisma.$queryRaw<{ variant_id: string; sku: string; name: string; color: string; size: string; available: number; product_id: string }[]>`
      SELECT v.id AS variant_id, v.sku, p.name, c.name AS color, s.label AS size, (i.quantity - i.reserved)::int AS available, p.id AS product_id
      FROM inventory i JOIN product_variants v ON v.id = i.variant_id JOIN products p ON p.id = v.product_id
      JOIN product_colors c ON c.id = v.color_id JOIN product_sizes s ON s.id = v.size_id
      WHERE p.is_active AND v.is_active AND (i.quantity - i.reserved) <= i.low_stock_threshold
      ORDER BY (i.quantity - i.reserved) ASC, p.name LIMIT 12`,
    prisma.product.findMany({ where: { isActive: true }, orderBy: { popularity: "desc" }, take: 6, select: { id: true, name: true, popularity: true, price: true } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, number: true, status: true, total: true, firstName: true, lastName: true, createdAt: true } }),
  ]);
  const lowCount = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM inventory i JOIN product_variants v ON v.id = i.variant_id JOIN products p ON p.id = v.product_id
    WHERE p.is_active AND v.is_active AND (i.quantity - i.reserved) <= i.low_stock_threshold`;

  const stats = [
    { label: "Товаров", value: `${activeProducts} / ${products}`, hint: "активных / всего", href: "/admin/products" },
    { label: "Заказов", value: orders, href: "/admin/orders" },
    { label: "Новые заказы", value: newOrders, href: "/admin/orders?status=NEW" },
    { label: "Оплаченные заказы", value: paidOrders, href: "/admin/orders?paid=1" },
    { label: "Продажи (всего)", value: formatPrice(revenue._sum.amount ?? 0), hint: `за 30 дней: ${formatPrice(revenue30._sum.amount ?? 0)}` },
    { label: "Низкий остаток", value: lowCount[0]?.n ?? 0, hint: "вариантов", href: "/admin/inventory?low=1" },
  ];

  return (
    <>
      <PageTitle title="Dashboard" />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => {
          const body = (
            <div className="h-full bg-white p-5" data-testid={`stat-${s.label}`}>
              <p className="eyebrow mb-3">{s.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
              {s.hint && <p className="mt-1 text-xs text-neutral-500">{s.hint}</p>}
            </div>
          );
          return s.href ? <Link key={s.label} href={s.href} className="hover:opacity-80">{body}</Link> : <div key={s.label}>{body}</div>;
        })}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Последние заказы">
            <Table>
              <thead><tr><th>№</th><th>Клиент</th><th>Статус</th><th className="text-right">Сумма</th><th>Дата</th></tr></thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-2 hover:underline">{o.number}</Link></td>
                    <td>{o.firstName} {o.lastName}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="text-right tabular-nums">{formatPrice(o.total)}</td>
                    <td className="text-neutral-500">{o.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}</td>
                  </tr>
                ))}
                {recent.length === 0 && <tr><td colSpan={5} className="text-center text-neutral-500">Заказов пока нет</td></tr>}
              </tbody>
            </Table>
          </Panel>
          <Panel title="Популярные товары">
            <ul className="divide-y text-sm">
              {popular.map((p) => (
                <li key={p.id} className="flex justify-between py-2">
                  <Link href={`/admin/products/${p.id}`} className="hover:underline">{p.name}</Link>
                  <span className="text-neutral-500">{p.popularity} продаж · {formatPrice(p.price)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <Panel title="Товары с низким остатком">
          <ul className="divide-y text-sm">
            {lowStock.map((v) => (
              <li key={v.variant_id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <Link href={`/admin/inventory?q=${encodeURIComponent(v.sku)}`} className="font-medium hover:underline">{v.name}</Link>
                  <p className="text-xs text-neutral-500">{v.color} · {v.size} · {v.sku}</p>
                </div>
                <span className={v.available === 0 ? "font-semibold text-red-700" : "font-semibold text-amber-700"}>{v.available} шт.</span>
              </li>
            ))}
          </ul>
          <Link href="/admin/inventory?low=1" className="mt-4 inline-block text-xs underline">Весь список →</Link>
        </Panel>
      </div>
    </>
  );
}
