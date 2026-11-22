"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn, SEASON_LABELS } from "@/lib/utils";

type Options = { sizes: string[]; colors: { name: string; hex: string }[]; minPrice: number; maxPrice: number };

function useParams() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const set = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    mut(p);
    p.delete("page");
    start(() => router.push(`${pathname}${p.toString() ? `?${p}` : ""}`, { scroll: false }));
  };
  const list = (k: string) => (sp.get(k) ?? "").split(",").filter(Boolean);
  const toggleIn = (k: string, v: string) =>
    set((p) => {
      const cur = (p.get(k) ?? "").split(",").filter(Boolean);
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      if (next.length) p.set(k, next.join(","));
      else p.delete(k);
    });
  return { sp, set, list, toggleIn, pending };
}

function FilterBody({ options }: { options: Options }) {
  const { sp, set, list, toggleIn } = useParams();
  const sizes = list("sizes");
  const colors = list("colors");
  const [min, setMin] = useState(sp.get("minPrice") ?? "");
  const [max, setMax] = useState(sp.get("maxPrice") ?? "");
  const flag = (k: string) => sp.get(k) === "1";
  const toggleFlag = (k: string) => set((p) => (p.get(k) === "1" ? p.delete(k) : p.set(k, "1")));

  return (
    <div className="space-y-8 text-sm">
      <fieldset>
        <legend className="eyebrow mb-3">Наличие</legend>
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" className="size-4 accent-ink" checked={flag("inStock")} onChange={() => toggleFlag("inStock")} data-testid="filter-instock" />
          Только в наличии
        </label>
        <label className="mt-2 flex cursor-pointer items-center gap-3">
          <input type="checkbox" className="size-4 accent-ink" checked={flag("sale")} onChange={() => toggleFlag("sale")} />
          Со скидкой
        </label>
        <label className="mt-2 flex cursor-pointer items-center gap-3">
          <input type="checkbox" className="size-4 accent-ink" checked={flag("isNew")} onChange={() => toggleFlag("isNew")} />
          Новинки
        </label>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-3">Размер</legend>
        <div className="flex flex-wrap gap-2">
          {options.sizes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleIn("sizes", s)}
              aria-pressed={sizes.includes(s)}
              className={cn("min-w-11 border px-3 py-2 text-xs", sizes.includes(s) ? "border-ink bg-ink text-white" : "hover:border-ink")}
              data-testid={`filter-size-${s}`}
            >
              {s}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-3">Цвет</legend>
        <div className="grid grid-cols-2 gap-2">
          {options.colors.map((c) => (
            <button key={c.name} type="button" onClick={() => toggleIn("colors", c.name)} aria-pressed={colors.includes(c.name)} className="flex items-center gap-2 text-left">
              <span className={cn("size-5 rounded-full border border-neutral-300", colors.includes(c.name) && "ring-2 ring-ink ring-offset-2")} style={{ backgroundColor: c.hex }} />
              <span className={cn("text-xs", colors.includes(c.name) && "font-semibold")}>{c.name}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-3">Цена, ₸</legend>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            set((p) => {
              if (min) p.set("minPrice", min);
              else p.delete("minPrice");
              if (max) p.set("maxPrice", max);
              else p.delete("maxPrice");
            });
          }}
        >
          <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} placeholder={String(options.minPrice)} className="h-10 w-full border px-2 text-xs" aria-label="Цена от" />
          <span>—</span>
          <input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} placeholder={String(options.maxPrice)} className="h-10 w-full border px-2 text-xs" aria-label="Цена до" />
          <button className="h-10 border border-ink px-3 text-xs">OK</button>
        </form>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-3">Сезон</legend>
        <div className="space-y-2">
          {Object.entries(SEASON_LABELS).map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-3">
              <input type="radio" name="season" className="size-4 accent-ink" checked={sp.get("season") === k} onChange={() => set((p) => p.set("season", k))} />
              {label}
            </label>
          ))}
          {sp.get("season") && (
            <button type="button" className="text-xs underline" onClick={() => set((p) => p.delete("season"))}>
              Любой сезон
            </button>
          )}
        </div>
      </fieldset>
    </div>
  );
}

export function CatalogFilters({ options }: { options: Options }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="hidden lg:block" aria-label="Фильтры">
        <FilterBody options={options} />
      </aside>
      <div className="lg:hidden">
        <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
          <SlidersHorizontal /> Фильтры
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" title="Фильтры">
            <div className="flex-1 overflow-y-auto p-6">
              <FilterBody options={options} />
            </div>
            <div className="border-t p-4">
              <Button className="w-full" onClick={() => setOpen(false)}>Показать</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

export function SortSelect() {
  const { sp, set } = useParams();
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="uppercase tracking-[0.16em] text-neutral-500">Сортировка</span>
      <select
        value={sp.get("sort") ?? "new"}
        onChange={(e) => set((p) => p.set("sort", e.target.value))}
        className="border-b border-ink bg-transparent py-1 pr-2 text-sm outline-none"
        data-testid="sort-select"
      >
        <option value="new">Сначала новые</option>
        <option value="popular">Сначала популярные</option>
        <option value="price_asc">Цена: по возрастанию</option>
        <option value="price_desc">Цена: по убыванию</option>
      </select>
    </label>
  );
}

const LABELS: Record<string, (v: string) => string> = {
  q: (v) => `«${v}»`,
  sizes: (v) => `Размер: ${v}`,
  colors: (v) => `Цвет: ${v}`,
  minPrice: (v) => `от ${v} ₸`,
  maxPrice: (v) => `до ${v} ₸`,
  season: (v) => SEASON_LABELS[v] ?? v,
  inStock: () => "В наличии",
  sale: () => "Sale",
  isNew: () => "Новинки",
};

export function ActiveFilters() {
  const { sp, set } = useParams();
  const chips = [...sp.entries()].filter(([k]) => LABELS[k]);
  if (!chips.length) return <span />;
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(([k, v]) => (
        <button key={k} onClick={() => set((p) => p.delete(k))} className="flex items-center gap-1 bg-paper-muted px-3 py-1.5 text-xs hover:bg-neutral-200">
          {LABELS[k](v)} <X className="size-3" />
        </button>
      ))}
    </div>
  );
}
