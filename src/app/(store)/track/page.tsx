import type { Metadata } from "next";
import { TrackForm } from "@/components/checkout/track-form";

export const metadata: Metadata = { title: "Отследить заказ" };

export default function TrackPage() {
  return (
    <div className="container max-w-lg py-16 md:py-24">
      <p className="eyebrow mb-3">Отслеживание</p>
      <h1 className="h-display mb-4 text-5xl">Где мой заказ?</h1>
      <p className="mb-10 text-neutral-600">Введите номер заказа и телефон, указанный при оформлении.</p>
      <TrackForm />
    </div>
  );
}
