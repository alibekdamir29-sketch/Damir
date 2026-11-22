"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api-client";

export function TrackForm() {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        setBusy(true);
        try {
          const r = await api<{ token: string }>("/api/orders/track", { method: "POST", json: { number, phone } });
          router.push(`/order/${r.token}`);
        } catch (e) {
          setErr(e instanceof ApiError ? e.message : "Ошибка");
          setBusy(false);
        }
      }}
    >
      <div>
        <Label htmlFor="number">Номер заказа</Label>
        <Input id="number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="DM-2026-0001" required />
      </div>
      <div>
        <Label htmlFor="phone">Телефон</Label>
        <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 700 000 00 00" required />
      </div>
      {err && <p className="text-sm text-red-700" role="alert">{err}</p>}
      <Button className="w-full" disabled={busy}>{busy ? "Ищем…" : "Найти заказ"}</Button>
    </form>
  );
}
