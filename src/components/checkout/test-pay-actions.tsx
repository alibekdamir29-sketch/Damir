"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export function TestPayActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async (outcome: "SUCCEEDED" | "FAILED") => {
    setBusy(true);
    try {
      const r = await api<{ token: string }>(`/api/payments/test/${paymentId}`, { method: "POST", json: { outcome } });
      router.push(`/order/${r.token}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Ошибка");
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-3">
      <Button onClick={() => go("SUCCEEDED")} disabled={busy} data-testid="test-pay-success">Оплата прошла успешно</Button>
      <Button variant="outline" onClick={() => go("FAILED")} disabled={busy}>Оплата отклонена</Button>
      {err && <p className="text-sm text-red-700">{err}</p>}
    </div>
  );
}
