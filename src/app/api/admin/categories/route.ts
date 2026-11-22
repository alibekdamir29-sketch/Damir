import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { AppError, handle } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { audit } from "@/lib/audit";
import { categorySchema } from "@/lib/admin-categories";



export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin();
  const data = categorySchema.parse(await req.json());
  const slug = slugify(data.slug || data.name);
  if (await prisma.category.findUnique({ where: { slug } })) throw new AppError("DUPLICATE", "Категория с таким slug уже есть", 409);
  const c = await prisma.category.create({ data: { ...data, slug } });
  await audit({ actorId: admin.id, action: "category.create", entity: "category", entityId: c.id });
  return NextResponse.json(c, { status: 201 });
});
