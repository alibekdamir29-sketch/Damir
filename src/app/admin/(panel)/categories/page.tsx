import { prisma } from "@/lib/db";
import { PageTitle } from "@/components/admin/ui";
import { CategoryManager } from "@/components/admin/category-manager";

export const metadata = { title: "Категории" };

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } });
  return (
    <>
      <PageTitle title="Категории" />
      <CategoryManager categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description ?? "", imageUrl: c.imageUrl ?? "", sortOrder: c.sortOrder, isActive: c.isActive, count: c._count.products }))} />
    </>
  );
}
