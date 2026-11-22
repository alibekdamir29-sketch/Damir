"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";

export function StockEditor({ variantId, quantity, reserved }: { variantId: string; quantity: number; reserved: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(quantity));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const changed = Number(value) !== quantity;
  return (
    <form
      className="flex flex-wrap items-center gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0) return setErr("≥ 0");
        if (n < reserved) return setErr(`мин. ${reserved} (резерв)`);
        setBusy(true);
        try {
          await api("/api/admin/inventory", { method: "POST", json: { variantId, set: n, reason: reason || (n > quantity ? "Поступление" : "Корректировка"), type: n > quantity ? "RESTOCK" : "ADJUSTMENT" } });
          setReason("");
          router.refresh();
        } catch (e) {
          setErr(e instanceof ApiError ? e.message : "Ошибка");
        } finally {
          setBusy(false);
        }
      }}
    >
      <input value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="h-8 w-16 border px-2 text-sm" aria-label="Новое количество" data-testid={`stock-${variantId}`} />
      {changed && <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина" className="h-8 w-28 border px-2 text-xs" />}
      {changed && <button disabled={busy} className="h-8 bg-ink px-3 text-xs text-white disabled:opacity-40">OK</button>}
      {err && <span className="w-full text-xs text-red-700">{err}</span>}
    </form>
  );
}
