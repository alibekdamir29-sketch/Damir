import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { productInputSchema, saveProduct } from "@/lib/admin-products";
import { audit } from "@/lib/audit";

export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin();
  const input = productInputSchema.parse(await req.json());
  const product = await saveProduct(input);
  await audit({ actorId: admin.id, action: "product.create", entity: "product", entityId: product.id, meta: { sku: product.sku } });
  return NextResponse.json({ id: product.id }, { status: 201 });
});
