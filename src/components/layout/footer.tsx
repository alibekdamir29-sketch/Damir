import Link from "next/link";
import { Camera, Mail, Phone, Clock } from "lucide-react";
import type { StoreSettings } from "@/lib/settings";

export function Footer({ settings, categories }: { settings: StoreSettings; categories: { slug: string; name: string }[] }) {
  const g = settings.general;
  return (
    <footer className="mt-24 bg-ink text-white">
      <div className="container grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <p className="font-display text-3xl tracking-[0.32em]">DAMIR</p>
          <p className="max-w-xs text-sm leading-relaxed text-neutral-400">Премиальная одежда для тех, кто ценит качество, крой и тишину минимализма.</p>
        </div>
        <div>
          <p className="eyebrow mb-5 text-neutral-500">Каталог</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-neutral-300">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/catalog?category=${c.slug}`} className="hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-5 text-neutral-500">Покупателям</p>
          <ul className="space-y-2 text-sm text-neutral-300">
            <li><Link href="/info/delivery" className="hover:text-white">Доставка и оплата</Link></li>
            <li><Link href="/info/returns" className="hover:text-white">Возврат и обмен</Link></li>
            <li><Link href="/track" className="hover:text-white">Отследить заказ</Link></li>
            <li><Link href="/account" className="hover:text-white">Личный кабинет</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-5 text-neutral-500">Контакты</p>
          <ul className="space-y-3 text-sm text-neutral-300">
            {g.phone && <li className="flex items-center gap-3"><Phone className="size-4" /><a href={`tel:${g.phone.replace(/[^+\d]/g, "")}`} className="hover:text-white">{g.phone}</a></li>}
            {g.email && <li className="flex items-center gap-3"><Mail className="size-4" /><a href={`mailto:${g.email}`} className="hover:text-white">{g.email}</a></li>}
            {g.instagram && <li className="flex items-center gap-3"><Camera className="size-4" /><a href={g.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white">Instagram</a></li>}
            {g.workingHours && <li className="flex items-center gap-3"><Clock className="size-4" />{g.workingHours}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container flex flex-col gap-2 py-6 text-xs text-neutral-500 md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} {g.storeName}. Все права защищены.</p>
          <p>{g.address}</p>
        </div>
      </div>
    </footer>
  );
}
