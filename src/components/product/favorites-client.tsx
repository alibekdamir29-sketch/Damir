"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/store/store-provider";
import type { ProductCard } from "@/lib/catalog";
import { ProductGrid } from "./product-card";
import { Button } from "@/components/ui/button";

export function FavoritesClient() {
  const { favorites } = useStore();
  const [items, setItems] = useState<ProductCard[] | null>(null);
  useEffect(() => {
    if (!favorites.length) return setItems([]);
    fetch(`/api/products/by-ids?ids=${favorites.join(",")}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items))
      .catch(() => setItems([]));
  }, [favorites]);
  return (
    <div className="container py-10 md:py-14">
      <h1 className="h-display mb-10 text-5xl">Избранное</h1>
      {items === null ? (
        <p className="text-sm text-neutral-500">Загрузка…</p>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-neutral-500">Здесь появятся товары, отмеченные сердечком.</p>
          <Button asChild className="mt-6"><Link href="/catalog">В каталог</Link></Button>
        </div>
      ) : (
        <ProductGrid products={items} />
      )}
    </div>
  );
}
