"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import type { ProductDetail } from "@/lib/catalog";
import { useStore } from "@/components/store/store-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, discountPercent } from "@/lib/utils";
import { Price } from "./price";
import { ProductImage } from "./product-image";
import { FavoriteButton } from "./favorite-button";

export function ProductPurchase({ product, children }: { product: ProductDetail; children?: React.ReactNode }) {
  const { addToCart } = useStore();
  const router = useRouter();
  const firstAvailableColor = product.colors.find((c) => c.available) ?? product.colors[0];
  const [colorId, setColorId] = useState(firstAvailableColor?.id);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<"cart" | "buy" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const images = useMemo(() => {
    const forColor = product.allImages.filter((i) => i.colorId === colorId);
    const rest = product.allImages.filter((i) => i.colorId !== colorId);
    return [...forColor, ...rest];
  }, [product.allImages, colorId]);
  const [active, setActive] = useState(0);

  const variantFor = (cId?: string, sId?: string | null) => product.variants.find((v) => v.colorId === cId && v.sizeId === sId);
  const variant = variantFor(colorId, sizeId);
  const stock = variant?.available ?? 0;
  const color = product.colors.find((c) => c.id === colorId);
  const d = discountPercent(product.price, product.oldPrice);

  async function submit(mode: "cart" | "buy") {
    setError(null);
    if (!sizeId) return setError("Выберите размер");
    if (!variant || stock <= 0) return setError("Этого размера в выбранном цвете нет в наличии");
    if (qty > stock) return setError(`В наличии только ${stock} шт.`);
    setBusy(mode);
    const ok = await addToCart(variant.id, qty);
    setBusy(null);
    if (ok && mode === "buy") router.push("/checkout");
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
      {/* Gallery */}
      <div className="grid gap-3 md:grid-cols-[72px_1fr]">
        <div className="no-scrollbar order-2 flex gap-2 overflow-x-auto md:order-1 md:flex-col">
          {images.map((img, i) => (
            <button key={img.url + i} onClick={() => setActive(i)} className={cn("w-16 shrink-0 border md:w-full", i === active ? "border-ink" : "border-transparent opacity-70 hover:opacity-100")} aria-label={`Фото ${i + 1}`}>
              <ProductImage src={img.url} alt={img.alt} className="aspect-[4/5]" />
            </button>
          ))}
        </div>
        <div className="relative order-1 md:order-2">
          <ProductImage src={images[active]?.url ?? images[0]?.url} alt={images[active]?.alt ?? product.name} priority className="aspect-[4/5] w-full" />
          <div className="absolute left-4 top-4 flex gap-2">
            {product.isNew && <Badge>New</Badge>}
            {d && <Badge variant="sale">−{d}%</Badge>}
          </div>
        </div>
      </div>

      {/* Purchase */}
      <div className="space-y-7 lg:sticky lg:top-28 lg:self-start">
        <div className="space-y-3">
          <p className="eyebrow">{product.category.name}</p>
          <div className="flex items-start justify-between gap-4">
            <h1 className="h-display text-4xl md:text-5xl" data-testid="product-title">{product.name}</h1>
            <FavoriteButton productId={product.id} className="mt-2 shrink-0 border" />
          </div>
          <Price price={product.price} oldPrice={product.oldPrice} size="lg" />
        </div>

        <div>
          <p className="mb-3 text-xs">
            <span className="uppercase tracking-[0.16em] text-neutral-500">Цвет:</span> <span className="font-medium">{color?.name}</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {product.colors.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setColorId(c.id);
                  setActive(0);
                  setError(null);
                  if (sizeId && !(variantFor(c.id, sizeId)?.available)) setSizeId(null);
                }}
                aria-label={c.name}
                aria-pressed={c.id === colorId}
                title={c.available ? c.name : `${c.name} — нет в наличии`}
                className={cn("relative size-9 rounded-full border border-neutral-300", c.id === colorId && "ring-2 ring-ink ring-offset-2", !c.available && "opacity-40")}
                style={{ backgroundColor: c.hex }}
                data-testid={`color-${c.name}`}
              >
                {!c.available && <span className="absolute left-1/2 top-1/2 h-px w-10 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-neutral-500" />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-neutral-500">Размер</p>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => {
              const v = variantFor(colorId, s.id);
              const ok = !!v && v.available > 0;
              return (
                <button
                  key={s.id}
                  disabled={!ok}
                  onClick={() => {
                    setSizeId(s.id);
                    setQty(1);
                    setError(null);
                  }}
                  aria-pressed={s.id === sizeId}
                  className={cn(
                    "h-11 min-w-12 border px-3 text-sm transition",
                    s.id === sizeId ? "border-ink bg-ink text-white" : "hover:border-ink",
                    !ok && "cursor-not-allowed text-neutral-300 line-through hover:border-border",
                  )}
                  data-testid={`size-${s.label}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 h-4 text-xs" data-testid="stock-status">
            {sizeId && variant ? (
              stock > 3 ? <span className="text-emerald-700">В наличии</span> : stock > 0 ? <span className="text-amber-700">Осталось {stock} шт.</span> : <span className="text-red-700">Нет в наличии</span>
            ) : !product.inStock ? (
              <span className="text-red-700">Товара нет в наличии</span>
            ) : (
              <span className="text-neutral-500">Выберите размер</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center border">
            <button className="p-3 disabled:opacity-30" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Меньше">
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center tabular-nums" data-testid="qty">{qty}</span>
            <button className="p-3 disabled:opacity-30" onClick={() => setQty((q) => q + 1)} disabled={!sizeId || qty >= Math.min(stock, 20)} aria-label="Больше">
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="lg" onClick={() => submit("cart")} disabled={!!busy || !product.inStock} data-testid="add-to-cart">
            {busy === "cart" ? "Добавляем…" : "Add to cart"}
          </Button>
          <Button size="lg" variant="outline" onClick={() => submit("buy")} disabled={!!busy || !product.inStock} data-testid="buy-now">
            {busy === "buy" ? "Секунду…" : "Buy now"}
          </Button>
        </div>

        {children}
      </div>
    </div>
  );
}
