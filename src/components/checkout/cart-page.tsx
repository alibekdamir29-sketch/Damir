"use client";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { useStore } from "@/components/store/store-provider";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/product/product-image";
import { cn, formatPrice } from "@/lib/utils";
import type { CartView } from "@/lib/cart";

function Line({ item }: { item: CartView["items"][number] }) {
  const { updateCartItem, removeCartItem } = useStore();
  const variantFor = (colorId: string, sizeId: string) => item.options.variants.find((v) => v.colorId === colorId && v.sizeId === sizeId);
  return (
    <li className="grid grid-cols-[96px_1fr] gap-4 py-6 sm:grid-cols-[120px_1fr] sm:gap-6" data-testid="cart-line">
      <Link href={`/product/${item.slug}`}>
        <ProductImage src={item.image} alt={item.name} className="aspect-[4/5]" />
      </Link>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href={`/product/${item.slug}`} className="font-medium">{item.name}</Link>
            <p className="mt-1 text-xs text-neutral-500">Арт. {item.sku}</p>
          </div>
          <button onClick={() => removeCartItem(item.id)} aria-label="Удалить" className="text-neutral-400 hover:text-ink" data-testid="cart-remove">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.14em] text-neutral-500">Цвет</span>
            <select
              className="border-b border-ink bg-transparent py-1 outline-none"
              value={item.color.id}
              onChange={(e) => {
                const v = variantFor(e.target.value, item.size.id) ?? item.options.variants.find((x) => x.colorId === e.target.value && x.available > 0);
                if (v) void updateCartItem(item.id, { variantId: v.id });
              }}
            >
              {item.options.colors.map((c) => {
                const any = item.options.variants.some((v) => v.colorId === c.id && v.available > 0);
                return <option key={c.id} value={c.id} disabled={!any}>{c.name}{any ? "" : " — нет"}</option>;
              })}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.14em] text-neutral-500">Размер</span>
            <select
              className="border-b border-ink bg-transparent py-1 outline-none"
              value={item.size.id}
              onChange={(e) => {
                const v = variantFor(item.color.id, e.target.value);
                if (v) void updateCartItem(item.id, { variantId: v.id });
              }}
              data-testid="cart-size"
            >
              {item.options.sizes.map((s) => {
                const v = variantFor(item.color.id, s.id);
                const ok = !!v && (v.available > 0 || v.id === item.variantId);
                return <option key={s.id} value={s.id} disabled={!ok}>{s.label}{ok ? "" : " — нет"}</option>;
              })}
            </select>
          </label>
        </div>

        {item.issue && (
          <p className="text-sm text-red-700" role="alert">
            {item.issue === "INSUFFICIENT_STOCK" ? `Доступно только ${item.available} шт. — уменьшите количество.` : "Товар закончился — удалите его или выберите другой размер/цвет."}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between">
          <div className="flex items-center border">
            <button className="p-2.5 disabled:opacity-30" onClick={() => updateCartItem(item.id, { quantity: item.quantity - 1 })} disabled={item.quantity <= 1} aria-label="Меньше">
              <Minus className="size-3.5" />
            </button>
            <span className="w-9 text-center text-sm tabular-nums" data-testid="cart-qty">{item.quantity}</span>
            <button className="p-2.5 disabled:opacity-30" onClick={() => updateCartItem(item.id, { quantity: item.quantity + 1 })} disabled={item.quantity >= Math.min(item.available, 20)} aria-label="Больше" data-testid="cart-inc">
              <Plus className="size-3.5" />
            </button>
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-500 tabular-nums">{formatPrice(item.unitPrice)} × {item.quantity}</p>
            <p className="font-semibold tabular-nums">{formatPrice(item.lineTotal)}</p>
          </div>
        </div>
      </div>
    </li>
  );
}

export function CartPageClient() {
  const { cart, cartLoading } = useStore();
  if (cartLoading) return <div className="container py-24 text-center text-sm text-neutral-500">Загрузка корзины…</div>;
  if (!cart || cart.items.length === 0)
    return (
      <div className="container py-24 text-center">
        <h1 className="h-display text-5xl">Корзина пуста</h1>
        <p className="mt-4 text-neutral-500">Добавьте товары из каталога — они сохранятся, даже если вы обновите страницу.</p>
        <Button asChild className="mt-8"><Link href="/catalog">В каталог</Link></Button>
      </div>
    );
  return (
    <div className="container py-10 md:py-14">
      <h1 className="h-display mb-10 text-5xl">Корзина</h1>
      <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
        <ul className="divide-y border-y">{cart.items.map((i) => <Line key={i.id} item={i} />)}</ul>
        <aside className="h-fit space-y-5 bg-paper-muted p-6 lg:sticky lg:top-28">
          <p className="eyebrow">Итого</p>
          <div className="flex justify-between text-sm"><span>Товары ({cart.count})</span><span className="tabular-nums" data-testid="cart-subtotal">{formatPrice(cart.subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span>Доставка</span><span className="text-neutral-500">рассчитается при оформлении</span></div>
          <div className="flex justify-between border-t pt-4 font-semibold"><span>К оплате</span><span className="tabular-nums">{formatPrice(cart.subtotal)}</span></div>
          <Button asChild className={cn("w-full", cart.hasIssues && "pointer-events-none opacity-40")} aria-disabled={cart.hasIssues}>
            <Link href="/checkout" data-testid="go-checkout">Оформить заказ</Link>
          </Button>
          {cart.hasIssues && <p className="text-xs text-red-700">Исправьте позиции с ошибками наличия, чтобы продолжить.</p>}
          <p className="text-xs text-neutral-500">Цены и наличие перепроверяются на сервере перед созданием заказа.</p>
        </aside>
      </div>
    </div>
  );
}
