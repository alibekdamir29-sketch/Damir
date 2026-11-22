import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { markPaymentReceived } from "@/lib/orders";
import { audit } from "@/lib/audit";

/** Manual confirmation for cash / bank-transfer payments. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  await markPaymentReceived(id, admin.adminId);
  await audit({ actorId: admin.id, action: "payment.manual_confirm", entity: "order", entityId: id });
  return NextResponse.json({ ok: true });
});
