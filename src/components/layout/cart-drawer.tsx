"use client";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/components/store/store-provider";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { ProductImage } from "@/components/product/product-image";

export function CartDrawer({ onNavigate }: { onNavigate: () => void }) {
  const { cart, updateCartItem, removeCartItem } = useStore();
  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <p className="font-display text-2xl">Ваша корзина пуста</p>
        <Button asChild variant="outline" onClick={onNavigate}>
          <Link href="/catalog">Перейти в каталог</Link>
        </Button>
      </div>
    );
  }
  return (
    <>
      <ul className="flex-1 divide-y overflow-y-auto px-6">
        {cart.items.map((i) => (
          <li key={i.id} className="flex gap-4 py-5">
            <Link href={`/product/${i.slug}`} onClick={onNavigate} className="w-20 shrink-0">
              <ProductImage src={i.image} alt={i.name} className="aspect-[4/5]" />
            </Link>
            <div className="flex flex-1 flex-col gap-1 text-sm">
              <div className="flex justify-between gap-2">
                <Link href={`/product/${i.slug}`} onClick={onNavigate} className="font-medium">
                  {i.name}
                </Link>
                <button aria-label="Удалить" onClick={() => removeCartItem(i.id)} className="text-neutral-400 hover:text-ink">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <p className="text-neutral-500">
                {i.color.name} · {i.size.label}
              </p>
              {i.issue && <p className="text-xs text-red-600">{i.issue === "INSUFFICIENT_STOCK" ? `Доступно только ${i.available} шт.` : "Нет в наличии"}</p>}
              <div className="mt-auto flex items-center justify-between">
                <div className="flex items-center border">
                  <button className="p-2 disabled:opacity-30" disabled={i.quantity <= 1} onClick={() => updateCartItem(i.id, { quantity: i.quantity - 1 })} aria-label="Меньше">
                    <Minus className="size-3" />
                  </button>
                  <span className="w-8 text-center tabular-nums">{i.quantity}</span>
                  <button className="p-2 disabled:opacity-30" disabled={i.quantity >= i.available} onClick={() => updateCartItem(i.id, { quantity: i.quantity + 1 })} aria-label="Больше">
                    <Plus className="size-3" />
                  </button>
                </div>
                <span className="font-medium tabular-nums">{formatPrice(i.lineTotal)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-4 border-t p-6">
        <div className="flex justify-between text-sm">
          <span className="uppercase tracking-[0.16em] text-neutral-500">Сумма</span>
          <span className="font-semibold tabular-nums">{formatPrice(cart.subtotal)}</span>
        </div>
        <p className="text-xs text-neutral-500">Стоимость доставки рассчитывается при оформлении.</p>
        <div className="grid gap-2">
          <Button asChild onClick={onNavigate}>
            <Link href="/checkout">Оформить заказ</Link>
          </Button>
          <Button asChild variant="outline" onClick={onNavigate}>
            <Link href="/cart">Открыть корзину</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
