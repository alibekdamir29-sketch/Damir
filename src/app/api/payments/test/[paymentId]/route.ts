import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, handle } from "@/lib/errors";
import { signTestWebhook, testProvider } from "@/lib/payments/test-provider";

/**
 * Development helper behind the test payment page: builds a signed webhook and
 * delivers it to our own webhook endpoint. Unavailable in production.
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ paymentId: string }> }) => {
  if (!testProvider.isConfigured()) throw new AppError("NOT_AVAILABLE", "Тестовый режим отключён", 404);
  const { paymentId } = await params;
  const { outcome } = z.object({ outcome: z.enum(["SUCCEEDED", "FAILED"]) }).parse(await req.json());
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: { select: { publicToken: true } } } });
  if (!payment || payment.provider !== "test") throw new AppError("NOT_FOUND", "Платёж не найден", 404);
  const body = JSON.stringify({ paymentId, status: outcome, amount: payment.amount });
  const res = await fetch(new URL("/api/payments/webhook/test", req.url), {
    method: "POST",
    headers: { "content-type": "application/json", "x-damir-signature": signTestWebhook(body) },
    body,
  });
  if (!res.ok) throw new AppError("WEBHOOK_FAILED", "Webhook отклонён", 502, await res.json().catch(() => null));
  return NextResponse.json({ ok: true, token: payment.order.publicToken });
});
