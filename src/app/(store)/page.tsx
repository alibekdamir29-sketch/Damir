import Link from "next/link";
import { ArrowRight, Gem, RefreshCcw, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { productCardInclude, toProductCard } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { ProductGrid } from "@/components/product/product-card";
import { ProductImage } from "@/components/product/product-image";
import { Button } from "@/components/ui/button";
import { OpenChatButton } from "@/components/ai/open-chat-button";
import { formatPrice } from "@/lib/utils";

async function load() {
  const base = { isActive: true, category: { isActive: true } } as const;
  const [featured, fresh, popular, sale, categories, settings] = await Promise.all([
    prisma.product.findMany({ where: { ...base, isFeatured: true }, orderBy: { popularity: "desc" }, take: 8, include: productCardInclude }),
    prisma.product.findMany({ where: { ...base, isNew: true }, orderBy: { createdAt: "desc" }, take: 4, include: productCardInclude }),
    prisma.product.findMany({ where: base, orderBy: { popularity: "desc" }, take: 4, include: productCardInclude }),
    prisma.product.findMany({ where: { ...base, oldPrice: { not: null } }, orderBy: { popularity: "desc" }, take: 4, include: productCardInclude }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  return { featured: featured.map(toProductCard), fresh: fresh.map(toProductCard), popular: popular.map(toProductCard), sale: sale.map(toProductCard), categories, settings };
}

function SectionHead({ eyebrow, title, href, cta = "Смотреть все" }: { eyebrow: string; title: string; href?: string; cta?: string }) {
  return (
    <div className="mb-10 flex items-end justify-between gap-6">
      <div>
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h2 className="h-display text-4xl md:text-5xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="link-underline hidden shrink-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] sm:flex">
          {cta} <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const { featured, fresh, popular, sale, categories, settings } = await load();
  const heroImg = featured[0]?.images[0]?.url;
  const heroImg2 = fresh[0]?.images[0]?.url ?? featured[1]?.images[0]?.url;

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="container grid min-h-[calc(100svh-7rem)] items-center gap-10 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-0">
          <div className="animate-fade-up space-y-8">
            <p className="eyebrow text-neutral-400">Новая коллекция · {new Date().getFullYear()}</p>
            <h1 className="h-display text-[52px] sm:text-7xl xl:text-[104px]">
              Тишина формы.
              <br />
              <span className="italic text-neutral-400">Сила деталей.</span>
            </h1>
            <p className="max-w-md text-base leading-relaxed text-neutral-300">
              Премиальная одежда DAMIR: точный крой, честные материалы и вещи, которые носятся годами.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="inverse" size="lg">
                <Link href="/catalog">Смотреть каталог</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-ink">
                <Link href="/catalog?isNew=1">Новинки</Link>
              </Button>
            </div>
          </div>
          <div className="relative hidden h-[78vh] lg:block">
            <ProductImage src={heroImg} alt="DAMIR коллекция" priority className="absolute right-0 top-0 h-[86%] w-[72%]" />
            <ProductImage src={heroImg2} alt="DAMIR новинки" className="absolute bottom-0 left-0 h-[48%] w-[44%] border-[10px] border-ink" />
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="container py-20 md:py-28">
        <SectionHead eyebrow="Каталог" title="Категории" href="/catalog" />
        <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-6">
          {categories.map((c) => (
            <Link key={c.id} href={`/catalog?category=${c.slug}`} className="group w-36 shrink-0 snap-start md:w-auto">
              <ProductImage src={c.imageUrl} alt={c.name} className="aspect-square transition group-hover:opacity-90" />
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em]">{c.name}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      {featured.length > 0 && (
        <section className="container pb-20 md:pb-28">
          <SectionHead eyebrow="Выбор DAMIR" title="Избранные товары" href="/catalog?sort=popular" />
          <ProductGrid products={featured} />
        </section>
      )}

      {/* NEW COLLECTION */}
      {fresh.length > 0 && (
        <section className="bg-paper-muted py-20 md:py-28">
          <div className="container">
            <SectionHead eyebrow="Только что поступили" title="Новая коллекция" href="/catalog?isNew=1" />
            <ProductGrid products={fresh} />
          </div>
        </section>
      )}

      {/* POPULAR */}
      <section className="container py-20 md:py-28">
        <SectionHead eyebrow="Бестселлеры" title="Популярное" href="/catalog?sort=popular" />
        <ProductGrid products={popular} />
      </section>

      {/* SPECIAL OFFERS */}
      {sale.length > 0 && (
        <section>
          <div className="bg-ink py-16 text-white md:py-20">
            <div className="container grid gap-8 lg:grid-cols-2 lg:items-end">
              <div>
                <p className="eyebrow mb-3 text-neutral-400">Специальные предложения</p>
                <h2 className="h-display text-5xl md:text-6xl">Sale</h2>
              </div>
              <div className="flex flex-col gap-4 lg:items-end">
                <p className="max-w-md text-neutral-400 lg:text-right">Избранные модели по специальным ценам. Количество ограничено.</p>
                <Button asChild variant="inverse">
                  <Link href="/catalog?sale=1">Все предложения</Link>
                </Button>
              </div>
            </div>
          </div>
          <div className="container pt-12">
            <ProductGrid products={sale} />
          </div>
        </section>
      )}

      {/* AI CONSULTANT */}
      <section className="container py-20 md:py-28">
        <div className="grid items-center gap-10 border p-8 md:p-14 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="eyebrow flex items-center gap-2"><Sparkles className="size-3.5" /> AI-консультант</p>
            <h2 className="h-display text-4xl md:text-5xl">Персональный стилист — 24/7</h2>
            <p className="max-w-lg text-neutral-600">
              Спросите на русском или казахском: «Есть чёрные худи?», «Подбери образ на осень», «А размер M есть?». Консультант проверит актуальные цены и наличие прямо в каталоге и покажет подходящие модели.
            </p>
            <OpenChatButton />
          </div>
          <div className="space-y-3 bg-paper-muted p-6 text-sm">
            <div className="ml-auto w-fit max-w-[80%] bg-ink px-4 py-3 text-white">Есть чёрные худи?</div>
            <div className="w-fit max-w-[85%] bg-white px-4 py-3">Конечно! Сейчас проверю доступные модели DAMIR. Вот варианты, которые есть в наличии.</div>
            <div className="ml-auto w-fit max-w-[80%] bg-ink px-4 py-3 text-white">А размер M есть?</div>
            <div className="w-fit max-w-[85%] bg-white px-4 py-3">Да, Signature Hoodie в чёрном цвете есть в размере M. Добавить в корзину?</div>
          </div>
        </div>
      </section>

      {/* ADVANTAGES */}
      <section className="border-y">
        <div className="container grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {[
            { icon: Gem, title: "Премиальные материалы", text: "Плотный хлопок, шерсть, кашемир и натуральная кожа." },
            { icon: Truck, title: "Доставка по Казахстану", text: settings.delivery.freeShippingFrom ? `Бесплатно от ${formatPrice(settings.delivery.freeShippingFrom)}.` : "Курьером или самовывозом." },
            { icon: RefreshCcw, title: "Возврат 14 дней", text: "Простой обмен и возврат без лишних вопросов." },
            { icon: ShieldCheck, title: "Безопасная оплата", text: "Оплата при получении или онлайн через защищённый сервис." },
          ].map((a) => (
            <div key={a.title} className="space-y-3 bg-white px-4 py-10 md:px-8">
              <a.icon className="size-6" strokeWidth={1.3} />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{a.title}</p>
              <p className="text-sm text-neutral-500">{a.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DELIVERY */}
      <section className="container py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="eyebrow mb-3">Доставка</p>
            <h2 className="h-display text-4xl md:text-5xl">Привезём быстро и бережно</h2>
            <p className="mt-6 max-w-md text-neutral-600">{settings.delivery.info}</p>
            <Link href="/info/delivery" className="link-underline mt-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]">
              Подробнее <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="divide-y border-y">
            {settings.delivery.cities.map((c) => (
              <div key={c.name} className="flex items-center justify-between py-4 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="text-neutral-500">{c.etaDays} дн.</span>
                <span className="tabular-nums">{formatPrice(c.cost)}</span>
              </div>
            ))}
            {settings.delivery.pickupEnabled && (
              <div className="flex items-center justify-between py-4 text-sm">
                <span className="font-medium">Самовывоз</span>
                <span className="text-neutral-500">{settings.delivery.pickupAddress}</span>
                <span>Бесплатно</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
