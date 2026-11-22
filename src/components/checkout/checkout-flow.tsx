"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Check, Info } from "lucide-react";
import { useStore } from "@/components/store/store-provider";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { ProductImage } from "@/components/product/product-image";
import { api, ApiError } from "@/lib/api-client";
import type { CartView } from "@/lib/cart";
import { PAYMENT_METHOD_LABELS, cn, formatPrice, normalizePhone } from "@/lib/utils";

type Method = "CASH_ON_DELIVERY" | "ONLINE" | "BANK_TRANSFER";
type QuoteRes = {
  cart: CartView;
  subtotal: number;
  delivery: { ok: true; cost: number; methodName: string } | { ok: false; reason: string };
  total: number;
  paymentMethods: Record<Method, boolean> & { onlineConfiguredInSettings: boolean; onlineProvider: { id: string; title: string; testMode: boolean } | null };
};

const STEPS = ["Покупатель", "Доставка", "Оплата", "Подтверждение"];
const IDEM_KEY = "damir:checkout-key";

function getIdempotencyKey() {
  try {
    let k = sessionStorage.getItem(IDEM_KEY);
    if (!k) {
      k = crypto.randomUUID();
      sessionStorage.setItem(IDEM_KEY, k);
    }
    return k;
  } catch {
    return crypto.randomUUID();
  }
}

export function CheckoutFlow({
  prefill,
  cities,
  pickup,
  bankDetails,
}: {
  prefill: { firstName: string; lastName: string; phone: string; email: string } | null;
  cities: { name: string; cost: number; etaDays: string }[];
  pickup: string | null;
  bankDetails: string;
}) {
  const router = useRouter();
  const { refreshCart } = useStore();
  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState({ firstName: prefill?.firstName ?? "", lastName: prefill?.lastName ?? "", phone: prefill?.phone ?? "", email: prefill?.email ?? "" });
  const [delivery, setDelivery] = useState({ type: "COURIER" as "COURIER" | "PICKUP", city: cities[0]?.name ?? "", street: "", house: "", apartment: "", comment: "" });
  const [method, setMethod] = useState<Method | null>(null);
  const [quote, setQuote] = useState<QuoteRes | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<React.ReactNode>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadQuote = useCallback(async () => {
    const q = await api<QuoteRes>("/api/checkout/quote", { method: "POST", json: { type: delivery.type, city: delivery.city } });
    setQuote(q);
    return q;
  }, [delivery.type, delivery.city]);

  useEffect(() => {
    void loadQuote().catch(() => {});
  }, [loadQuote]);

  useEffect(() => {
    if (!quote || method) return;
    const pm = quote.paymentMethods;
    setMethod(pm.CASH_ON_DELIVERY ? "CASH_ON_DELIVERY" : pm.ONLINE ? "ONLINE" : pm.BANK_TRANSFER ? "BANK_TRANSFER" : null);
  }, [quote, method]);

  if (quote && quote.cart.items.length === 0)
    return (
      <div className="container py-24 text-center">
        <h1 className="h-display text-5xl">Корзина пуста</h1>
        <Button asChild className="mt-8"><Link href="/catalog">В каталог</Link></Button>
      </div>
    );

  function validateStep(s: number) {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!customer.firstName.trim()) e.firstName = "Введите имя";
      if (!customer.lastName.trim()) e.lastName = "Введите фамилию";
      if (!normalizePhone(customer.phone)) e.phone = "Введите номер в формате +7 XXX XXX XX XX";
      if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) e.email = "Неверный email";
    }
    if (s === 1 && delivery.type === "COURIER") {
      if (!delivery.city) e.city = "Выберите город";
      if (!delivery.street.trim()) e.street = "Введите улицу";
      if (!delivery.house.trim()) e.house = "Введите номер дома";
    }
    if (s === 1 && quote && !quote.delivery.ok) e.city = quote.delivery.reason;
    if (s === 2 && !method) e.method = "Выберите способ оплаты";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validateStep(step)) setStep((s) => Math.min(3, s + 1));
  }

  async function confirm() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await api<{ number: string; token: string; paymentRedirectUrl: string | null }>("/api/checkout/order", {
        method: "POST",
        json: {
          idempotencyKey: getIdempotencyKey(),
          customer: { ...customer, email: customer.email || "" },
          delivery: delivery.type === "PICKUP" ? { type: "PICKUP", comment: delivery.comment } : delivery,
          paymentMethod: method,
          expectedTotal: quote?.total,
        },
      });
      try {
        sessionStorage.removeItem(IDEM_KEY);
      } catch {
        /* ignore */
      }
      await refreshCart();
      if (res.paymentRedirectUrl) window.location.href = res.paymentRedirectUrl;
      else router.push(`/order/${res.token}?new=1`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "PRICE_CHANGED") {
        await loadQuote();
        setSubmitError("Цены или стоимость доставки изменились. Проверьте обновлённый итог и подтвердите заказ ещё раз.");
      } else if (e instanceof ApiError && (e.code === "CART_CHANGED" || e.code === "INSUFFICIENT_STOCK")) {
        await loadQuote();
        await refreshCart();
        setSubmitError(<>{e.message} <Link href="/cart" className="underline">Перейти в корзину</Link></>);
      } else {
        setSubmitError(e instanceof ApiError ? e.message : "Не удалось оформить заказ. Попробуйте ещё раз.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const pm = quote?.paymentMethods;
  const field = (k: keyof typeof customer, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} value={customer[k]} onChange={(e) => setCustomer({ ...customer, [k]: e.target.value })} aria-invalid={!!errors[k]} {...props} />
      <FieldError>{errors[k]}</FieldError>
    </div>
  );
  const dfield = (k: "street" | "house" | "apartment", label: string) => (
    <div>
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} value={delivery[k]} onChange={(e) => setDelivery({ ...delivery, [k]: e.target.value })} aria-invalid={!!errors[k]} />
      <FieldError>{errors[k]}</FieldError>
    </div>
  );

  return (
    <div className="container py-10 md:py-14">
      <h1 className="h-display mb-8 text-5xl">Оформление заказа</h1>

      <ol className="mb-10 grid grid-cols-4 gap-2" aria-label="Шаги оформления">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => i < step && setStep(i)}
              className={cn("w-full border-t-2 pt-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-[11px]", i <= step ? "border-ink text-ink" : "border-border text-neutral-400")}
            >
              <span className="mr-1 tabular-nums">0{i + 1}</span> <span className="hidden sm:inline">{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="grid gap-12 lg:grid-cols-[1fr_400px]">
        <div>
          {step === 0 && (
            <section className="space-y-5" aria-labelledby="s1">
              <h2 id="s1" className="font-display text-3xl">Информация о покупателе</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {field("firstName", "Имя *", { autoComplete: "given-name" })}
                {field("lastName", "Фамилия *", { autoComplete: "family-name" })}
                {field("phone", "Телефон *", { type: "tel", autoComplete: "tel", placeholder: "+7 700 000 00 00" })}
                {field("email", "Email (необязательно)", { type: "email", autoComplete: "email" })}
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-6" aria-labelledby="s2">
              <h2 id="s2" className="font-display text-3xl">Доставка</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setDelivery({ ...delivery, type: "COURIER" })} className={cn("border p-4 text-left", delivery.type === "COURIER" ? "border-ink" : "hover:border-neutral-400")}>
                  <p className="font-medium">Курьерская доставка</p>
                  <p className="text-sm text-neutral-500">По городам Казахстана</p>
                </button>
                {pickup && (
                  <button type="button" onClick={() => setDelivery({ ...delivery, type: "PICKUP" })} className={cn("border p-4 text-left", delivery.type === "PICKUP" ? "border-ink" : "hover:border-neutral-400")} data-testid="pickup">
                    <p className="font-medium">Самовывоз — бесплатно</p>
                    <p className="text-sm text-neutral-500">{pickup}</p>
                  </button>
                )}
              </div>
              {delivery.type === "COURIER" && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="city">Город *</Label>
                    <NativeSelect id="city" value={delivery.city} onChange={(e) => setDelivery({ ...delivery, city: e.target.value })}>
                      {cities.map((c) => (
                        <option key={c.name} value={c.name}>{c.name} — {formatPrice(c.cost)}, {c.etaDays} дн.</option>
                      ))}
                    </NativeSelect>
                    <FieldError>{errors.city}</FieldError>
                  </div>
                  {dfield("street", "Улица *")}
                  {dfield("house", "Дом *")}
                  {dfield("apartment", "Квартира")}
                </div>
              )}
              <div>
                <Label htmlFor="comment">Комментарий к заказу</Label>
                <Textarea id="comment" value={delivery.comment} onChange={(e) => setDelivery({ ...delivery, comment: e.target.value })} maxLength={500} placeholder="Домофон, удобное время…" />
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4" aria-labelledby="s3">
              <h2 id="s3" className="font-display text-3xl">Способ оплаты</h2>
              {(["CASH_ON_DELIVERY", "ONLINE", "BANK_TRANSFER"] as Method[]).map((m) => {
                const enabled = !!pm?.[m];
                if (m === "BANK_TRANSFER" && !enabled) return null;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={!enabled}
                    onClick={() => setMethod(m)}
                    className={cn("flex w-full items-start gap-4 border p-5 text-left", method === m ? "border-ink" : "hover:border-neutral-400", !enabled && "cursor-not-allowed opacity-50")}
                    data-testid={`pay-${m}`}
                  >
                    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", method === m && "border-ink bg-ink")}>{method === m && <Check className="size-3 text-white" />}</span>
                    <span>
                      <span className="block font-medium">{PAYMENT_METHOD_LABELS[m]}</span>
                      <span className="block text-sm text-neutral-500">
                        {m === "CASH_ON_DELIVERY" && "Наличными или картой курьеру / в шоуруме при получении."}
                        {m === "ONLINE" &&
                          (enabled
                            ? `Вы перейдёте на защищённую страницу платёжного сервиса. Данные карты не передаются в DAMIR.${pm?.onlineProvider?.testMode ? " Сейчас включён ТЕСТОВЫЙ режим — реальные деньги не списываются." : ""}`
                            : "Онлайн-оплата пока не подключена. Выберите оплату при получении.")}
                        {m === "BANK_TRANSFER" && "Реквизиты для перевода появятся после подтверждения заказа."}
                      </span>
                    </span>
                  </button>
                );
              })}
              {pm && !pm.ONLINE && (
                <p className="flex gap-2 text-xs text-neutral-500"><Info className="size-4 shrink-0" /> Онлайн-оплата станет доступна после подключения платёжного провайдера администратором магазина.</p>
              )}
              <FieldError>{errors.method}</FieldError>
            </section>
          )}

          {step === 3 && quote && (
            <section className="space-y-8" aria-labelledby="s4">
              <h2 id="s4" className="font-display text-3xl">Проверьте заказ</h2>
              <ul className="divide-y border-y" data-testid="confirm-items">
                {quote.cart.items.map((i) => (
                  <li key={i.id} className="flex gap-4 py-4 text-sm">
                    <ProductImage src={i.image} alt={i.name} className="aspect-[4/5] w-16 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">{i.name}</p>
                      <p className="text-neutral-500">Цвет: {i.color.name} · Размер: {i.size.label} · {i.quantity} шт.</p>
                      {i.issue && <p className="text-red-700">Недостаточно на складе</p>}
                    </div>
                    <p className="tabular-nums">{formatPrice(i.lineTotal)}</p>
                  </li>
                ))}
              </ul>
              <dl className="grid gap-6 text-sm sm:grid-cols-3">
                <div>
                  <dt className="eyebrow mb-2">Контакты</dt>
                  <dd>{customer.firstName} {customer.lastName}<br />{normalizePhone(customer.phone)}{customer.email && <><br />{customer.email}</>}</dd>
                </div>
                <div>
                  <dt className="eyebrow mb-2">Доставка</dt>
                  <dd>
                    {delivery.type === "PICKUP" ? <>Самовывоз<br />{pickup}</> : <>{delivery.city}, {delivery.street}, д. {delivery.house}{delivery.apartment && `, кв. ${delivery.apartment}`}</>}
                    {delivery.comment && <><br /><span className="text-neutral-500">«{delivery.comment}»</span></>}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow mb-2">Оплата</dt>
                  <dd>{method && PAYMENT_METHOD_LABELS[method]}</dd>
                  {method === "BANK_TRANSFER" && bankDetails && <dd className="mt-1 text-xs text-neutral-500">Реквизиты будут на странице заказа</dd>}
                </div>
              </dl>
              {submitError && <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{submitError}</div>}
            </section>
          )}

          <div className="mt-10 flex flex-wrap gap-3">
            {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={submitting}>Назад</Button>}
            {step < 3 ? (
              <Button onClick={next} data-testid="checkout-next">Продолжить</Button>
            ) : (
              <Button onClick={confirm} disabled={submitting || !quote || quote.cart.hasIssues || !quote.delivery.ok} size="lg" data-testid="confirm-order">
                {submitting ? "Создаём заказ…" : "Confirm order"}
              </Button>
            )}
          </div>
        </div>

        <aside className="h-fit space-y-4 bg-paper-muted p-6 lg:sticky lg:top-28" aria-label="Сводка заказа">
          <p className="eyebrow">Ваш заказ</p>
          {quote ? (
            <>
              <ul className="space-y-3">
                {quote.cart.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 text-sm">
                    <span>{i.name} <span className="text-neutral-500">· {i.size.label} · ×{i.quantity}</span></span>
                    <span className="tabular-nums">{formatPrice(i.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-2 border-t pt-4 text-sm">
                <div className="flex justify-between"><span>Товары</span><span className="tabular-nums">{formatPrice(quote.subtotal)}</span></div>
                <div className="flex justify-between">
                  <span>Доставка</span>
                  <span className="tabular-nums" data-testid="delivery-cost">{quote.delivery.ok ? (quote.delivery.cost === 0 ? "Бесплатно" : formatPrice(quote.delivery.cost)) : "—"}</span>
                </div>
              </div>
              <div className="flex justify-between border-t pt-4 text-lg font-semibold"><span>Итого</span><span className="tabular-nums" data-testid="checkout-total">{formatPrice(quote.total)}</span></div>
            </>
          ) : (
            <p className="text-sm text-neutral-500">Загрузка…</p>
          )}
        </aside>
      </div>
    </div>
  );
}
