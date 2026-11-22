"use client";
import { Heart } from "lucide-react";
import { useStore } from "@/components/store/store-provider";
import { cn } from "@/lib/utils";

export function FavoriteButton({ productId, className }: { productId: string; className?: string }) {
  const { isFavorite, toggleFavorite } = useStore();
  const on = isFavorite(productId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(productId);
      }}
      aria-pressed={on}
      aria-label={on ? "Убрать из избранного" : "В избранное"}
      className={cn("grid size-9 place-items-center bg-white/90 backdrop-blur transition hover:bg-white", className)}
    >
      <Heart className={cn("size-4", on && "fill-ink")} />
    </button>
  );
}
