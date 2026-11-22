import Link from "next/link";
import type { ProductCard as Card } from "@/lib/catalog";
import { Badge } from "@/components/ui/badge";
import { discountPercent } from "@/lib/utils";
import { Price } from "./price";
import { ProductImage } from "./product-image";
import { FavoriteButton } from "./favorite-button";

export function ProductCard({ product, priority }: { product: Card; priority?: boolean }) {
  const d = discountPercent(product.price, product.oldPrice);
  const [first, second] = product.images;
  return (
    <article className="group relative" data-testid="product-card">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative">
          <ProductImage src={first?.url} alt={first?.alt ?? product.name} priority={priority} className="aspect-[4/5] transition-opacity duration-500" />
          {second && (
            <ProductImage src={second.url} alt={second.alt} className="absolute inset-0 aspect-[4/5] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          )}
          <div className="absolute left-3 top-3 flex flex-col gap-1">
            {product.isNew && <Badge>New</Badge>}
            {d && <Badge variant="sale">−{d}%</Badge>}
            {!product.inStock && <Badge variant="muted">Нет в наличии</Badge>}
          </div>
          {product.inStock && (
            <div className="absolute inset-x-0 bottom-0 hidden translate-y-2 bg-white/95 px-4 py-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Размеры</p>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                {product.sizes.map((s) => (
                  <span key={s.id} className={s.available ? "" : "text-neutral-300 line-through"}>
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{product.category.name}</p>
          <h3 className="text-sm font-medium leading-snug">{product.name}</h3>
          <Price price={product.price} oldPrice={product.oldPrice} size="sm" />
          <div className="flex gap-1.5 pt-1">
            {product.colors.map((c) => (
              <span key={c.id} title={c.name} className="size-3 rounded-full border border-neutral-300" style={{ backgroundColor: c.hex }} />
            ))}
          </div>
        </div>
      </Link>
      <FavoriteButton productId={product.id} className="absolute right-3 top-3" />
    </article>
  );
}

export function ProductGrid({ products, className }: { products: Card[]; className?: string }) {
  return (
    <div className={className ?? "grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4"}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
