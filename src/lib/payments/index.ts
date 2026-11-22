import { cloudPaymentsProvider } from "./cloudpayments";
import { testProvider } from "./test-provider";
import type { PaymentProvider } from "./types";

export const PROVIDERS: Record<string, PaymentProvider> = {
  [testProvider.id]: testProvider,
  [cloudPaymentsProvider.id]: cloudPaymentsProvider,
};

/** Online provider selected by PAYMENT_PROVIDER env; null if none is configured. */
export function getOnlineProvider(): PaymentProvider | null {
  const id = process.env.PAYMENT_PROVIDER;
  if (!id) return null;
  const p = PROVIDERS[id];
  return p && p.isConfigured() ? p : null;
}

export function getProviderById(id: string): PaymentProvider | null {
  return PROVIDERS[id] ?? null;
}

export type { PaymentProvider } from "./types";
