import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";

export const metadata: Metadata = { title: "Оформление заказа", robots: { index: false } };

export default async function CheckoutPage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  return (
    <CheckoutFlow
      prefill={user ? { firstName: user.firstName, lastName: user.lastName ?? "", phone: user.phone ?? "", email: user.email } : null}
      cities={settings.delivery.cities.map((c) => ({ name: c.name, cost: c.cost, etaDays: c.etaDays }))}
      pickup={settings.delivery.pickupEnabled ? settings.delivery.pickupAddress : null}
      bankDetails={settings.payments.bankDetails}
    />
  );
}
