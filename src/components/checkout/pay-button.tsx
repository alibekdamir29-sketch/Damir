"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export function PayButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const r = await api<{ redirectUrl: string }>(`/api/orders/${token}/pay`, { method: "POST" });
            window.location.href = r.redirectUrl;
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : "Ошибка");
            setBusy(false);
          }
        }}
      >
        {busy ? "Переход…" : "Оплатить онлайн"}
      </Button>
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
    </div>
  );
}
