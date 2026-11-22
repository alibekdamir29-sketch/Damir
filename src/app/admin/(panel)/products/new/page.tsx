import { prisma } from "@/lib/db";
import { ProductForm } from "@/components/admin/product-form";
import { PageTitle } from "@/components/admin/ui";

export const metadata = { title: "Новый товар" };

export default async function NewProduct() {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageTitle title="Новый товар" />
      <ProductForm categories={categories} />
    </>
  );
}
