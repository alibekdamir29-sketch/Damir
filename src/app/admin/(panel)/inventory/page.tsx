import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PageTitle, Panel, Table } from "@/components/admin/ui";
import { StockEditor } from "@/components/admin/stock-editor";
import { cn } from "@/lib/utils";

export const metadata = { title: "Склад" };

const TYPE_LABELS: Record<string, string> = { INITIAL: "Начальный", RESTOCK: "Поступление", ADJUSTMENT: "Корректировка", RESERVE: "Резерв", RELEASE: "Снятие резерва", SALE: "Отгрузка", RETURN: "Возврат" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; low?: string; product?: string }> }) {
  const sp = await searchParams;
  const conds: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (sp.q) conds.push(Prisma.sql`(p.name ILIKE ${"%" + sp.q + "%"} OR v.sku ILIKE ${"%" + sp.q + "%"})`);
  if (sp.low) conds.push(Prisma.sql`(i.quantity - i.reserved) <= i.low_stock_threshold`);
  if (sp.product) conds.push(Prisma.sql`p.id = ${sp.product}`);
  const rows = await prisma.$queryRaw<
    { variant_id: string; sku: string; product_id: string; name: string; color: string; hex: string; size: string; quantity: number; reserved: number; threshold: number; active: boolean }[]
  >`
    SELECT v.id AS variant_id, v.sku, p.id AS product_id, p.name, c.name AS color, c.hex, s.label AS size,
           COALESCE(i.quantity,0)::int AS quantity, COALESCE(i.reserved,0)::int AS reserved, COALESCE(i.low_stock_threshold,3)::int AS threshold, p.is_active AS active
    FROM product_variants v
    JOIN products p ON p.id = v.product_id
    JOIN product_colors c ON c.id = v.color_id
    JOIN product_sizes s ON s.id = v.size_id
    LEFT JOIN inventory i ON i.variant_id = v.id
    WHERE ${Prisma.join(conds, " AND ")}
    ORDER BY p.name, c.sort_order, s.sort_order
    LIMIT 500`;
  const movements = await prisma.inventoryMovement.findMany({
    where: sp.product ? { variant: { productId: sp.product } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { variant: { select: { sku: true, product: { select: { name: true } } } }, order: { select: { id: true, number: true } }, admin: { include: { user: { select: { email: true } } } } },
  });

  return (
    <>
      <PageTitle title="Склад (Inventory)" />
      <form className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <input name="q" defaultValue={sp.q} placeholder="Товар или SKU варианта" className="h-10 w-64 border bg-white px-3" />
        {sp.product && <input type="hidden" name="product" value={sp.product} />}
        <label className="flex items-center gap-2"><input type="checkbox" name="low" value="1" defaultChecked={!!sp.low} className="accent-ink" /> Только низкий остаток</label>
        <button className="h-10 border border-ink bg-white px-4 text-xs uppercase tracking-[0.14em]">Применить</button>
        {(sp.q || sp.low || sp.product) && <Link href="/admin/inventory" className="text-xs underline">Сбросить</Link>}
      </form>
      <Table>
        <thead><tr><th>Товар</th><th>Цвет</th><th>Размер</th><th>SKU</th><th>На складе</th><th>В резерве</th><th>Доступно</th><th>Изменить остаток</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const avail = r.quantity - r.reserved;
            return (
              <tr key={r.variant_id} className={cn(!r.active && "opacity-50")}>
                <td><Link href={`/admin/products/${r.product_id}`} className="hover:underline">{r.name}</Link></td>
                <td><span className="mr-2 inline-block size-3 rounded-full border align-middle" style={{ background: r.hex }} />{r.color}</td>
                <td>{r.size}</td>
                <td className="text-xs text-neutral-500">{r.sku}</td>
                <td className="tabular-nums">{r.quantity}</td>
                <td className="tabular-nums text-neutral-500">{r.reserved}</td>
                <td className={cn("font-semibold tabular-nums", avail === 0 ? "text-red-700" : avail <= r.threshold ? "text-amber-700" : "")}>{avail}</td>
                <td><StockEditor variantId={r.variant_id} quantity={r.quantity} reserved={r.reserved} /></td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={8} className="text-center text-neutral-500">Ничего не найдено</td></tr>}
        </tbody>
      </Table>

      <Panel title="История движения товаров" className="mt-6">
        <Table>
          <thead><tr><th>Дата</th><th>Товар / SKU</th><th>Операция</th><th>Δ склад</th><th>Δ резерв</th><th>После</th><th>Основание</th></tr></thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td className="text-xs text-neutral-500">{m.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}</td>
                <td>{m.variant.product.name}<br /><span className="text-xs text-neutral-500">{m.variant.sku}</span></td>
                <td>{TYPE_LABELS[m.type]}</td>
                <td className="tabular-nums">{m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}</td>
                <td className="tabular-nums">{m.reservedDelta > 0 ? `+${m.reservedDelta}` : m.reservedDelta}</td>
                <td className="text-xs tabular-nums">{m.quantityAfter} / резерв {m.reservedAfter}</td>
                <td className="text-xs">
                  {m.order ? <Link href={`/admin/orders/${m.order.id}`} className="underline">{m.order.number}</Link> : null}
                  {m.reason && <span className="text-neutral-500"> {m.reason}</span>}
                  {m.admin && <span className="text-neutral-400"> · {m.admin.user.email}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
