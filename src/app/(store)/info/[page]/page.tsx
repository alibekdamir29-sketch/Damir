import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { PAYMENT_METHOD_LABELS, formatPrice } from "@/lib/utils";

export default async function InfoPage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (page !== "delivery" && page !== "returns") notFound();
  const s = await getSettings();
  return (
    <div className="container max-w-3xl py-16 md:py-24">
      {page === "delivery" ? (
        <>
          <h1 className="h-display mb-8 text-5xl">Доставка и оплата</h1>
          <p className="mb-10 text-neutral-700">{s.delivery.info}</p>
          <table className="mb-12 w-full text-left text-sm">
            <thead className="border-b"><tr><th className="py-3 font-semibold">Город</th><th>Срок</th><th className="text-right">Стоимость</th></tr></thead>
            <tbody className="divide-y">
              {s.delivery.cities.map((c) => (
                <tr key={c.name}><td className="py-3">{c.name}</td><td>{c.etaDays} дн.</td><td className="text-right tabular-nums">{formatPrice(c.cost)}</td></tr>
              ))}
              {s.delivery.pickupEnabled && <tr><td className="py-3">Самовывоз</td><td>{s.delivery.pickupAddress}</td><td className="text-right">Бесплатно</td></tr>}
            </tbody>
          </table>
          {s.delivery.freeShippingFrom && <p className="mb-10 text-sm">Бесплатная доставка при заказе от {formatPrice(s.delivery.freeShippingFrom)}.</p>}
          <h2 className="mb-4 font-display text-3xl">Способы оплаты</h2>
          <ul className="list-inside list-disc space-y-1 text-neutral-700">
            {s.payments.cashOnDelivery && <li>{PAYMENT_METHOD_LABELS.CASH_ON_DELIVERY}</li>}
            {s.payments.online && <li>{PAYMENT_METHOD_LABELS.ONLINE} (через защищённый платёжный сервис)</li>}
            {s.payments.bankTransfer && <li>{PAYMENT_METHOD_LABELS.BANK_TRANSFER}</li>}
          </ul>
        </>
      ) : (
        <>
          <h1 className="h-display mb-8 text-5xl">Возврат и обмен</h1>
          <p className="whitespace-pre-line leading-relaxed text-neutral-700">{s.returns.policy}</p>
        </>
      )}
    </div>
  );
}
