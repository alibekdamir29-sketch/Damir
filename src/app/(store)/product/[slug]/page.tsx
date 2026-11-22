import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Truck, RefreshCcw, ShieldCheck } from "lucide-react";
import { getProductBySlug, getRecommendations } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { ProductPurchase } from "@/components/product/product-purchase";
import { ProductGrid } from "@/components/product/product-card";
import { SEASON_LABELS, formatPrice } from "@/lib/utils";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return { title: "Товар не найден" };
  return { title: p.name, description: p.description.slice(0, 160), openGraph: { images: p.images[0]?.url ? [p.images[0].url] : [] } };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [recs, settings] = await Promise.all([getRecommendations(product.id, product.category.slug), getSettings()]);

  const details = [
    ["Артикул", product.sku],
    ["Материал", product.material],
    ["Состав", product.composition],
    ["Сезон", SEASON_LABELS[product.season]],
    ["Стиль", product.style],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="container py-8 md:py-12">
      <nav className="mb-6 text-xs text-neutral-500" aria-label="Хлебные крошки">
        <Link href="/" className="hover:text-ink">Главная</Link> / <Link href="/catalog" className="hover:text-ink">Каталог</Link> /{" "}
        <Link href={`/catalog?category=${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link> / <span className="text-ink">{product.name}</span>
      </nav>

      <ProductPurchase product={product}>
        <div className="space-y-6 border-t pt-6 text-sm">
          <div>
            <p className="eyebrow mb-3">Описание</p>
            <p className="leading-relaxed text-neutral-700">{product.description}</p>
          </div>
          <dl className="grid grid-cols-[120px_1fr] gap-y-2">
            {details.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-neutral-500">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-3 border-t pt-6 text-neutral-700">
            <li className="flex gap-3"><Truck className="size-5 shrink-0" strokeWidth={1.4} />
              <span>
                Доставка по Казахстану{settings.delivery.cities[0] ? ` от ${formatPrice(Math.min(...settings.delivery.cities.map((c) => c.cost)))}` : ""}
                {settings.delivery.freeShippingFrom ? `, бесплатно от ${formatPrice(settings.delivery.freeShippingFrom)}` : ""}.
                {settings.delivery.pickupEnabled ? " Самовывоз — бесплатно." : ""}
              </span>
            </li>
            <li className="flex gap-3"><RefreshCcw className="size-5 shrink-0" strokeWidth={1.4} /><span>Возврат и обмен в течение 14 дней.</span></li>
            <li className="flex gap-3"><ShieldCheck className="size-5 shrink-0" strokeWidth={1.4} /><span>Оплата при получении или онлайн через защищённый платёжный сервис.</span></li>
          </ul>
        </div>
      </ProductPurchase>

      {recs.length > 0 && (
        <section className="mt-24">
          <p className="eyebrow mb-3">Рекомендуем</p>
          <h2 className="h-display mb-10 text-4xl">Вам может понравиться</h2>
          <ProductGrid products={recs} />
        </section>
      )}
    </div>
  );
}
