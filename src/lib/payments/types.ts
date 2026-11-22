export type CreatePaymentInput = {
  paymentId: string; // our payments.id
  orderNumber: string;
  amount: number; // ₸
  currency: string;
  description: string;
  customer: { email?: string | null; phone: string };
  returnUrl: string; // where the customer lands after paying
};

export type CreatePaymentResult = { providerPaymentId: string; redirectUrl: string };

export type WebhookEvent = {
  /** Our payments.id (or provider id if ours is not echoed back). */
  paymentId?: string;
  providerPaymentId?: string;
  orderNumber?: string;
  status: "SUCCEEDED" | "FAILED";
  amount: number;
  currency?: string;
  raw: Record<string, unknown>;
};

export interface PaymentProvider {
  id: string;
  title: string;
  /** true only when every required secret is present in env. */
  isConfigured(): boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /** Must verify the signature and throw on any mismatch. Never trust unsigned callbacks. */
  parseWebhook(req: Request, rawBody: string): Promise<WebhookEvent>;
  /** Body the provider expects as acknowledgement. */
  ackResponse(): Response;
}
