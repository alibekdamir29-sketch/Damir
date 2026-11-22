import { AppError } from "../errors";
import { hmacSha256, safeEqual } from "./crypto";
import type { PaymentProvider } from "./types";

/**
 * CloudPayments (works in Kazakhstan, KZT). Uses a hosted payment link, so card
 * data is entered only on the provider's page and never reaches our server.
 *  - create:  POST https://api.cloudpayments.ru/orders/create  (Basic auth publicId:apiSecret)
 *  - notify:  "Pay" / "Fail" notifications, signed with header Content-HMAC = base64(HMAC-SHA256(body, apiSecret))
 * Configure notification URLs in the CloudPayments dashboard:
 *   https://<your-domain>/api/payments/webhook/cloudpayments
 * Verify the flow in the provider's test mode before going live.
 */
const API = "https://api.cloudpayments.ru";

export const cloudPaymentsProvider: PaymentProvider = {
  id: "cloudpayments",
  title: "CloudPayments",
  isConfigured() {
    return !!process.env.CLOUDPAYMENTS_PUBLIC_ID && !!process.env.CLOUDPAYMENTS_API_SECRET;
  },
  async createPayment(input) {
    const auth = Buffer.from(`${process.env.CLOUDPAYMENTS_PUBLIC_ID}:${process.env.CLOUDPAYMENTS_API_SECRET}`).toString("base64");
    const res = await fetch(`${API}/orders/create`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        Amount: input.amount,
        Currency: input.currency,
        Description: input.description,
        Email: input.customer.email || undefined,
        Phone: input.customer.phone,
        InvoiceId: input.orderNumber,
        AccountId: input.customer.phone,
        JsonData: { paymentId: input.paymentId },
        SuccessRedirectUrl: input.returnUrl,
        FailRedirectUrl: input.returnUrl,
      }),
    });
    const data = (await res.json().catch(() => null)) as { Success?: boolean; Model?: { Id: string; Url: string }; Message?: string } | null;
    if (!res.ok || !data?.Success || !data.Model) {
      throw new AppError("PAYMENT_PROVIDER_ERROR", "Платёжный сервис временно недоступен. Попробуйте позже или выберите другой способ оплаты.", 502);
    }
    return { providerPaymentId: data.Model.Id, redirectUrl: data.Model.Url };
  },
  async parseWebhook(req, rawBody) {
    if (!this.isConfigured()) throw new AppError("PROVIDER_DISABLED", "Provider not configured", 403);
    const sig = req.headers.get("content-hmac") ?? req.headers.get("x-content-hmac") ?? "";
    const expected = hmacSha256(process.env.CLOUDPAYMENTS_API_SECRET!, rawBody, "base64");
    if (!safeEqual(sig, expected)) throw new AppError("BAD_SIGNATURE", "Invalid signature", 401);
    const p = Object.fromEntries(new URLSearchParams(rawBody)) as Record<string, string>;
    let paymentId: string | undefined;
    try {
      paymentId = p.Data ? (JSON.parse(p.Data) as { paymentId?: string }).paymentId : undefined;
    } catch {
      /* ignore */
    }
    const succeeded = p.Status === "Completed" || p.Status === "Authorized";
    // Never store card fragments: keep only non-sensitive fields.
    const raw = { TransactionId: p.TransactionId, InvoiceId: p.InvoiceId, Amount: p.Amount, Currency: p.Currency, Status: p.Status, OperationType: p.OperationType };
    return {
      paymentId,
      orderNumber: p.InvoiceId,
      status: succeeded ? "SUCCEEDED" : "FAILED",
      amount: Math.round(Number(p.Amount)),
      currency: p.Currency,
      raw,
    };
  },
  ackResponse() {
    return Response.json({ code: 0 });
  },
};
