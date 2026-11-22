import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { adjustStock } from "@/lib/inventory";
import { audit } from "@/lib/audit";

const schema = z
  .object({
    variantId: z.string().min(1),
    set: z.number().int().min(0).max(1_000_000).optional(),
    delta: z.number().int().min(-1_000_000).max(1_000_000).optional(),
    type: z.enum(["RESTOCK", "ADJUSTMENT", "RETURN"]).optional(),
    reason: z.string().trim().min(2, "Укажите причину").max(300),
    lowStockThreshold: z.number().int().min(0).max(1000).optional(),
  })
  .refine((v) => v.set != null || v.delta != null || v.lowStockThreshold != null, "Укажите новое количество или изменение");

export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin();
  const body = schema.parse(await req.json());
  let after = null;
  if (body.set != null || body.delta != null) {
    after = await adjustStock({ variantId: body.variantId, adminId: admin.adminId, set: body.set, delta: body.delta, type: body.type, reason: body.reason });
  }
  if (body.lowStockThreshold != null) {
    const { prisma } = await import("@/lib/db");
    await prisma.inventory.update({ where: { variantId: body.variantId }, data: { lowStockThreshold: body.lowStockThreshold } });
  }
  await audit({ actorId: admin.id, action: "inventory.adjust", entity: "variant", entityId: body.variantId, meta: { set: body.set, delta: body.delta, reason: body.reason } });
  return NextResponse.json({ ok: true, inventory: after });
});
