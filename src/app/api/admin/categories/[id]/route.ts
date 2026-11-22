import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { AppError, handle } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { audit } from "@/lib/audit";
import { categorySchema } from "@/lib/admin-categories";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const data = categorySchema.parse(await req.json());
  const slug = slugify(data.slug || data.name);
  const clash = await prisma.category.findFirst({ where: { slug, id: { not: id } } });
  if (clash) throw new AppError("DUPLICATE", "Категория с таким slug уже есть", 409);
  const c = await prisma.category.update({ where: { id }, data: { ...data, slug } });
  await audit({ actorId: admin.id, action: "category.update", entity: "category", entityId: id });
  return NextResponse.json(c);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) throw new AppError("NOT_EMPTY", `В категории ${count} товаров. Перенесите их или скройте категорию.`, 409);
  await prisma.category.delete({ where: { id } });
  await audit({ actorId: admin.id, action: "category.delete", entity: "category", entityId: id });
  return NextResponse.json({ ok: true });
});
