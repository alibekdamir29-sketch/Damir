import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ProductForm } from "@/components/admin/product-form";
import { PageTitle } from "@/components/admin/ui";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { colors: { orderBy: { sortOrder: "asc" } }, sizes: { orderBy: { sortOrder: "asc" } }, images: { orderBy: { sortOrder: "asc" }, include: { color: true } } },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!p) notFound();
  return (
    <>
      <PageTitle title={p.name}>
        <Link href={`/admin/inventory?product=${p.id}`} className="text-xs underline">Остатки на складе →</Link>
        {p.isActive && <Link href={`/product/${p.slug}`} target="_blank" className="text-xs underline">На сайте ↗</Link>}
      </PageTitle>
      <ProductForm
        categories={categories}
        initial={{
          id: p.id,
          name: p.name,
          sku: p.sku,
          slug: p.slug,
          description: p.description,
          categoryId: p.categoryId,
          price: p.price,
          oldPrice: p.oldPrice,
          material: p.material ?? "",
          composition: p.composition ?? "",
          season: p.season,
          style: p.style ?? "",
          isActive: p.isActive,
          isFeatured: p.isFeatured,
          isNew: p.isNew,
          colors: p.colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex })),
          sizes: p.sizes.map((s) => ({ id: s.id, label: s.label })),
          images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? "", colorName: i.color?.name ?? "" })),
        }}
      />
    </>
  );
}
