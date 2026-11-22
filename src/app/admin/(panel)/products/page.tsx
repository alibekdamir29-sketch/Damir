import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { available } from "@/lib/catalog";
import { formatPrice } from "@/lib/utils";
import { PageTitle, Table } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/product/product-image";

export const metadata = { title: "Товары" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const sp = await searchParams;
  const where: Prisma.ProductWhereInput = {};
  if (sp.q) where.OR = [{ name: { contains: sp.q, mode: "insensitive" } }, { sku: { contains: sp.q, mode: "insensitive" } }];
  if (sp.category) where.categoryId = sp.category;
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { category: true, images: { take: 1, orderBy: { sortOrder: "asc" } }, variants: { include: { inventory: true } }, _count: { select: { colors: true, sizes: true } } },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <>
      <PageTitle title="Товары">
        <Button asChild size="sm"><Link href="/admin/products/new">+ Добавить товар</Link></Button>
      </PageTitle>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Название или артикул" className="h-10 w-64 border bg-white px-3 text-sm" />
        <select name="category" defaultValue={sp.category ?? ""} className="h-10 border bg-white px-3 text-sm">
          <option value="">Все категории</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button size="sm" variant="outline" className="h-10">Найти</Button>
      </form>
      <Table>
        <thead><tr><th></th><th>Товар</th><th>Артикул</th><th>Категория</th><th className="text-right">Цена</th><th>Варианты</th><th>Остаток</th><th>Статус</th></tr></thead>
        <tbody>
          {products.map((p) => {
            const stock = p.variants.reduce((n, v) => n + available(v.inventory), 0);
            return (
              <tr key={p.id}>
                <td className="w-14"><ProductImage src={p.images[0]?.url} alt={p.name} className="aspect-[4/5] w-10" /></td>
                <td><Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">{p.name}</Link></td>
                <td className="text-xs text-neutral-500">{p.sku}</td>
                <td>{p.category.name}</td>
                <td className="text-right tabular-nums">{formatPrice(p.price)}{p.oldPrice && <><br /><span className="text-xs text-neutral-400 line-through">{formatPrice(p.oldPrice)}</span></>}</td>
                <td className="text-xs">{p._count.colors} цв. × {p._count.sizes} разм.</td>
                <td className={stock === 0 ? "text-red-700" : ""}>{stock} шт.</td>
                <td className="space-x-1">
                  {p.isActive ? <Badge variant="success">Активен</Badge> : <Badge variant="muted">Скрыт</Badge>}
                  {p.isFeatured && <Badge variant="outline">★</Badge>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
