"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";
import { ORDER_STATUS_LABELS } from "@/lib/utils";

export function OrderActions({ orderId, allowed, canConfirmPayment }: { orderId: string; allowed: string[]; canConfirmPayment: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      setNote("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed.length && !canConfirmPayment) return <p className="text-sm text-neutral-500">Заказ в финальном статусе.</p>;
  return (
    <div className="space-y-3">
      <Textarea placeholder="Комментарий (необязательно)" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[60px]" />
      <div className="flex flex-wrap gap-2">
        {allowed.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={s === "CANCELLED" ? "destructive" : "outline"}
            disabled={busy}
            onClick={() => {
              if (s === "CANCELLED" && !confirm("Отменить заказ? Резерв товара будет снят.")) return;
              void run(() => api(`/api/admin/orders/${orderId}`, { method: "PATCH", json: { status: s, note: note || undefined } }));
            }}
            data-testid={`status-${s}`}
          >
            {ORDER_STATUS_LABELS[s]}
          </Button>
        ))}
      </div>
      {canConfirmPayment && (
        <Button size="sm" disabled={busy} onClick={() => run(() => api(`/api/admin/orders/${orderId}/payment`, { method: "POST" }))}>
          Подтвердить получение оплаты
        </Button>
      )}
      {err && <p className="text-sm text-red-700">{err}</p>}
      <p className="text-xs text-neutral-500">Отправка (SHIPPED) списывает товар со склада. Отмена снимает резерв. Онлайн-оплата подтверждается только webhook-ом провайдера.</p>
    </div>
  );
}
