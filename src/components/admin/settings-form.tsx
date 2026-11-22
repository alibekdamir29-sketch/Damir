"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { StoreSettings } from "@/lib/settings";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsForm({ initial, providerInfo, aiEnabled }: { initial: StoreSettings; providerInfo: string; aiEnabled: boolean }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const g = <K extends keyof StoreSettings["general"]>(k: K, v: string) => setS({ ...s, general: { ...s.general, [k]: v } });

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      setS(await api<StoreSettings>("/api/admin/settings", { method: "PUT", json: s }));
      setMsg({ ok: true, text: "Настройки сохранены" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : "Ошибка" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="space-y-4 bg-white p-5">
        <h2 className="eyebrow text-ink">Магазин и контакты</h2>
        {([["storeName", "Название магазина"], ["phone", "Контактный телефон"], ["email", "Email"], ["instagram", "Instagram (ссылка)"], ["workingHours", "График работы"], ["address", "Адрес"]] as const).map(([k, l]) => (
          <div key={k}><Label>{l}</Label><Input value={s.general[k]} onChange={(e) => g(k, e.target.value)} /></div>
        ))}
      </section>

      <section className="space-y-4 bg-white p-5">
        <h2 className="eyebrow text-ink">Доставка</h2>
        <div className="space-y-2">
          <Label>Города и стоимость</Label>
          {s.delivery.cities.map((c, i) => (
            <div key={i} className="flex gap-2">
              <Input className="h-10" value={c.name} placeholder="Город" onChange={(e) => setS({ ...s, delivery: { ...s.delivery, cities: s.delivery.cities.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) } })} />
              <Input className="h-10 w-28" inputMode="numeric" value={c.cost} onChange={(e) => setS({ ...s, delivery: { ...s.delivery, cities: s.delivery.cities.map((x, j) => (j === i ? { ...x, cost: Number(e.target.value.replace(/\D/g, "")) } : x)) } })} aria-label="Стоимость" />
              <Input className="h-10 w-24" value={c.etaDays} placeholder="дни" onChange={(e) => setS({ ...s, delivery: { ...s.delivery, cities: s.delivery.cities.map((x, j) => (j === i ? { ...x, etaDays: e.target.value } : x)) } })} aria-label="Срок" />
              <button onClick={() => setS({ ...s, delivery: { ...s.delivery, cities: s.delivery.cities.filter((_, j) => j !== i) } })} aria-label="Удалить город"><Trash2 className="size-4" /></button>
            </div>
          ))}
          <button className="text-xs underline" onClick={() => setS({ ...s, delivery: { ...s.delivery, cities: [...s.delivery.cities, { name: "", cost: 2000, etaDays: "2–4" }] } })}>+ Добавить город</button>
        </div>
        <div>
          <Label>Бесплатная доставка от, ₸ (пусто — нет)</Label>
          <Input inputMode="numeric" value={s.delivery.freeShippingFrom ?? ""} onChange={(e) => setS({ ...s, delivery: { ...s.delivery, freeShippingFrom: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null } })} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={s.delivery.pickupEnabled} onChange={(e) => setS({ ...s, delivery: { ...s.delivery, pickupEnabled: e.target.checked } })} /> Самовывоз включён</label>
        <div><Label>Адрес самовывоза</Label><Input value={s.delivery.pickupAddress} onChange={(e) => setS({ ...s, delivery: { ...s.delivery, pickupAddress: e.target.value } })} /></div>
        <div><Label>Информация о доставке</Label><Textarea value={s.delivery.info} onChange={(e) => setS({ ...s, delivery: { ...s.delivery, info: e.target.value } })} /></div>
      </section>

      <section className="space-y-4 bg-white p-5">
        <h2 className="eyebrow text-ink">Способы оплаты</h2>
        <p className="bg-paper-muted p-3 text-xs">{providerInfo}</p>
        {([["cashOnDelivery", "Оплата при получении"], ["online", "Онлайн-оплата (если провайдер подключён)"], ["bankTransfer", "Банковский перевод"]] as const).map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={s.payments[k]} onChange={(e) => setS({ ...s, payments: { ...s.payments, [k]: e.target.checked } })} /> {l}</label>
        ))}
        <div><Label>Реквизиты для банковского перевода</Label><Textarea value={s.payments.bankDetails} onChange={(e) => setS({ ...s, payments: { ...s.payments, bankDetails: e.target.value } })} placeholder="Получатель, БИН, IBAN, банк…" /></div>
      </section>

      <section className="space-y-4 bg-white p-5">
        <h2 className="eyebrow text-ink">Возврат</h2>
        <div><Label>Условия возврата</Label><Textarea rows={6} value={s.returns.policy} onChange={(e) => setS({ ...s, returns: { policy: e.target.value } })} /></div>
        <h2 className="eyebrow pt-4 text-ink">AI-консультант</h2>
        <p className="text-sm">{aiEnabled ? "Подключён (ANTHROPIC_API_KEY задан)." : "Не подключён: задайте ANTHROPIC_API_KEY в .env и перезапустите сервер."}</p>
      </section>

      <div className="sticky bottom-4 flex items-center gap-4 bg-white p-4 shadow-lg xl:col-span-2">
        <Button onClick={save} disabled={busy}>{busy ? "Сохранение…" : "Сохранить настройки"}</Button>
        {msg && <p className={msg.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{msg.text}</p>}
      </div>
    </div>
  );
}
