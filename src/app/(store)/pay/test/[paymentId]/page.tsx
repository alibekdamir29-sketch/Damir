import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { testProvider } from "@/lib/payments/test-provider";
import { formatPrice } from "@/lib/utils";
import { TestPayActions } from "@/components/checkout/test-pay-actions";

export const metadata = { title: "Тестовая оплата", robots: { index: false } };

/** Development-only stand-in for a provider's hosted payment page. No card fields on purpose. */
export default async function TestPayPage({ params }: { params: Promise<{ paymentId: string }> }) {
  if (!testProvider.isConfigured()) notFound();
  const { paymentId } = await params;
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: { select: { number: true, publicToken: true } } } });
  if (!payment || payment.provider !== "test") notFound();
  return (
    <div className="container max-w-md py-20 text-center">
      <p className="mb-6 inline-block bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900">Тестовый режим · разработка</p>
      <h1 className="h-display mb-4 text-4xl">Оплата заказа {payment.order.number}</h1>
      <p className="mb-2 text-2xl font-semibold">{formatPrice(payment.amount)}</p>
      <p className="mb-10 text-sm text-neutral-500">Здесь будет страница платёжного провайдера. Деньги не списываются. Выберите результат, чтобы проверить подписанный webhook.</p>
      {payment.status === "PENDING" ? <TestPayActions paymentId={payment.id} /> : <p className="text-sm">Статус платежа: {payment.status}</p>}
    </div>
  );
}
