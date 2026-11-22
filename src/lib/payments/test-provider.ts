import { AppError } from "../errors";
import { hmacSha256, safeEqual } from "./crypto";
import type { PaymentProvider } from "./types";

/**
 * TEST provider — development only. It never touches real money or card data:
 * the "payment page" (/pay/test/[paymentId]) just lets the developer choose
 * success/failure, then the server sends itself a webhook signed with
 * PAYMENT_WEBHOOK_SECRET, exercising exactly the same verification path as a real provider.
 * Disabled automatically when NODE_ENV=production.
 */
export const testProvider: PaymentProvider = {
  id: "test",
  title: "Тестовый режим (разработка)",
  isConfigured() {
    return process.env.NODE_ENV !== "production" && !!process.env.PAYMENT_WEBHOOK_SECRET;
  },
  async createPayment(input) {
    const base = process.env.APP_URL ?? "http://localhost:3000";
    return { providerPaymentId: `test_${input.paymentId}`, redirectUrl: `${base}/pay/test/${input.paymentId}` };
  },
  async parseWebhook(req, rawBody) {
    if (!this.isConfigured()) throw new AppError("PROVIDER_DISABLED", "Тестовый провайдер отключён", 403);
    const sig = req.headers.get("x-damir-signature") ?? "";
    const expected = hmacSha256(process.env.PAYMENT_WEBHOOK_SECRET!, rawBody);
    if (!safeEqual(sig, expected)) throw new AppError("BAD_SIGNATURE", "Invalid signature", 401);
    const body = JSON.parse(rawBody) as { paymentId: string; status: "SUCCEEDED" | "FAILED"; amount: number };
    return { paymentId: body.paymentId, providerPaymentId: `test_${body.paymentId}`, status: body.status, amount: body.amount, raw: body };
  },
  ackResponse() {
    return Response.json({ ok: true });
  },
};

export function signTestWebhook(body: string) {
  return hmacSha256(process.env.PAYMENT_WEBHOOK_SECRET!, body);
}
