import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { deleteProduct, productInputSchema, saveProduct } from "@/lib/admin-products";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const before = await prisma.product.findUnique({ where: { id }, select: { price: true, oldPrice: true } });
  const input = productInputSchema.parse(await req.json());
  await saveProduct(input, id);
  await audit({
    actorId: admin.id,
    action: "product.update",
    entity: "product",
    entityId: id,
    meta: before && (before.price !== input.price || before.oldPrice !== (input.oldPrice ?? null)) ? { priceFrom: before.price, priceTo: input.price } : undefined,
  });
  return NextResponse.json({ id });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const res = await deleteProduct(id);
  await audit({ actorId: admin.id, action: `product.${res.mode}`, entity: "product", entityId: id });
  return NextResponse.json(res);
});
