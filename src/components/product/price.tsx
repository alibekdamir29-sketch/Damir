import { cn, discountPercent, formatPrice } from "@/lib/utils";

export function Price({ price, oldPrice, className, size = "md" }: { price: number; oldPrice?: number | null; className?: string; size?: "sm" | "md" | "lg" }) {
  const d = discountPercent(price, oldPrice);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}>
      <span className={cn("font-semibold tabular-nums", size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-[15px]", d && "text-red-700")}>{formatPrice(price)}</span>
      {d && (
        <>
          <span className={cn("tabular-nums text-neutral-400 line-through", size === "lg" ? "text-base" : "text-sm")}>{formatPrice(oldPrice!)}</span>
          <span className="text-xs font-semibold text-red-700">−{d}%</span>
        </>
      )}
    </div>
  );
}
