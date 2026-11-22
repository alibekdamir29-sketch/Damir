import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { changeOrderStatus } from "@/lib/orders";
import { audit } from "@/lib/audit";

const schema = z.object({
  status: z.enum(["NEW", "CONFIRMED", "PAYMENT_PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
  note: z.string().trim().max(500).optional(),
});

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const { status, note } = schema.parse(await req.json());
  // Online payments can only be marked PAID by the verified provider webhook.
  if (status === "PAID") {
    const { prisma } = await import("@/lib/db");
    const o = await prisma.order.findUnique({ where: { id }, select: { paymentMethod: true } });
    if (o?.paymentMethod === "ONLINE") {
      return NextResponse.json({ error: { code: "ONLINE_PAYMENT", message: "Онлайн-оплата подтверждается только платёжным провайдером" } }, { status: 409 });
    }
  }
  const res = await changeOrderStatus(id, status, { adminId: admin.adminId, source: "admin", note });
  await audit({ actorId: admin.id, action: "order.status", entity: "order", entityId: id, meta: { from: res.from, to: res.to } });
  return NextResponse.json(res);
});
