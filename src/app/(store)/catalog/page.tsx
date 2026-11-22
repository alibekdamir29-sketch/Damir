import type { Metadata } from "next";
import Link from "next/link";
import { getFilterOptions, listProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/product-card";
import { CatalogFilters, SortSelect, ActiveFilters } from "@/components/product/catalog-filters";
import { cn } from "@/lib/utils";

type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  if (sp.sale) return { title: "Sale" };
  if (sp.isNew) return { title: "Новинки" };
  return { title: "Каталог" };
}

export default async function CatalogPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [result, options] = await Promise.all([listProducts(sp), getFilterOptions()]);
  const q = result.query;
  const categoryName = options.categories.find((c) => c.slug === q.category)?.name;
  const title = q.q ? `Поиск: «${q.q}»` : q.sale ? "Sale" : q.isNew ? "Новинки" : categoryName ?? "Каталог";

  const pageHref = (page: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") p.set(k, v);
    if (page > 1) p.set("page", String(page));
    return `/catalog${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="container py-10 md:py-14">
      <div className="mb-8 space-y-3">
        <nav className="text-xs text-neutral-500" aria-label="Хлебные крошки">
          <Link href="/" className="hover:text-ink">Главная</Link> / <span>Каталог</span>
          {categoryName && <> / <span>{categoryName}</span></>}
        </nav>
        <h1 className="h-display text-5xl md:text-6xl">{title}</h1>
        <p className="text-sm text-neutral-500" data-testid="catalog-total">{result.total} товаров</p>
      </div>

      <div className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        <Link href="/catalog" className={cn("shrink-0 border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em]", !q.category ? "border-ink bg-ink text-white" : "hover:border-ink")}>Все</Link>
        {options.categories.map((c) => (
          <Link key={c.slug} href={`/catalog?category=${c.slug}`} className={cn("shrink-0 border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em]", q.category === c.slug ? "border-ink bg-ink text-white" : "hover:border-ink")}>
            {c.name}
          </Link>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <CatalogFilters options={options} />
        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <ActiveFilters />
            <SortSelect />
          </div>
          {result.items.length ? (
            <ProductGrid products={result.items} className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6" />
          ) : (
            <div className="py-24 text-center">
              <p className="font-display text-3xl">Ничего не найдено</p>
              <p className="mt-3 text-sm text-neutral-500">Попробуйте изменить фильтры или спросите AI-стилиста.</p>
              <Link href="/catalog" className="mt-6 inline-block text-[11px] font-semibold uppercase tracking-[0.2em] underline underline-offset-4">Сбросить фильтры</Link>
            </div>
          )}
          {result.pages > 1 && (
            <nav className="mt-16 flex justify-center gap-2" aria-label="Страницы">
              {Array.from({ length: result.pages }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={pageHref(p)} className={cn("grid size-10 place-items-center border text-sm", p === result.page ? "border-ink bg-ink text-white" : "hover:border-ink")} aria-current={p === result.page ? "page" : undefined}>
                  {p}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
