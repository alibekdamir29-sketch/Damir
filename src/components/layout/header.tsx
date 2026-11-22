"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useStore } from "@/components/store/store-provider";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CartDrawer } from "@/components/layout/cart-drawer";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Главная" },
  { href: "/catalog", label: "Каталог" },
  { href: "/catalog?isNew=1", label: "Новинки" },
  { href: "/catalog?sale=1", label: "Sale" },
];

export function Header({ user, announcement }: { user: { firstName: string; role: string } | null; announcement?: string }) {
  const { cart, favorites, cartOpen, setCartOpen } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname, sp]);
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const isActive = (href: string) => {
    const [p, q] = href.split("?");
    if (q) return pathname === p && sp.toString() === q;
    return href === "/" ? pathname === "/" : pathname.startsWith(p) && !sp.get("isNew") && !sp.get("sale");
  };

  function submitSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q")?.toString().trim();
    if (q) router.push(`/catalog?q=${encodeURIComponent(q)}`);
  }

  const count = cart?.count ?? 0;

  return (
    <>
      {announcement && (
        <div className="bg-ink px-4 py-2 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-white md:text-[11px] md:tracking-[0.2em]">{announcement}</div>
      )}
      <header className={cn("sticky top-0 z-40 border-b bg-white/95 backdrop-blur transition-shadow", scrolled && "shadow-[0_1px_0_rgba(0,0,0,.04),0_8px_24px_-16px_rgba(0,0,0,.25)]")}>
        <div className="container grid h-16 grid-cols-[1fr_auto_1fr] items-center md:h-20">
          <div className="flex items-center gap-1">
            <button className="-ml-2 p-2 lg:hidden" aria-label="Меню" onClick={() => setMenuOpen(true)}>
              <Menu className="size-5" />
            </button>
            <nav className="hidden items-center gap-8 lg:flex" aria-label="Основная навигация">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn("link-underline text-[11px] font-semibold uppercase tracking-[0.2em]", isActive(n.href) ? "after:w-full" : "text-neutral-600 hover:text-ink", n.label === "Sale" && "text-red-700")}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>

          <Link href="/" className="font-display text-[28px] font-semibold tracking-[0.32em] md:text-[34px]" aria-label="DAMIR — на главную">
            DAMIR
          </Link>

          <div className="flex items-center justify-end gap-0.5 md:gap-2">
            <button className="p-2 hover:opacity-60" aria-label="Поиск" onClick={() => setSearchOpen((v) => !v)}>
              {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
            </button>
            <Link href="/favorites" className="relative hidden p-2 hover:opacity-60 sm:block" aria-label="Избранное">
              <Heart className="size-5" />
              {favorites.length > 0 && <span className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-ink text-[9px] text-white">{favorites.length}</span>}
            </Link>
            <Link href={user ? (user.role === "ADMIN" ? "/account" : "/account") : "/login"} className="hidden p-2 hover:opacity-60 sm:block" aria-label="Профиль">
              <User className="size-5" />
            </Link>
            <button className="relative p-2 hover:opacity-60" aria-label={`Корзина, товаров: ${count}`} onClick={() => setCartOpen(true)} data-testid="cart-button">
              <ShoppingBag className="size-5" />
              {count > 0 && (
                <span data-testid="cart-count" className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-ink text-[9px] text-white">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="border-t bg-white">
            <form onSubmit={submitSearch} className="container flex items-center gap-4 py-5" role="search">
              <Search className="size-5 text-neutral-400" />
              <input
                ref={inputRef}
                name="q"
                defaultValue={sp.get("q") ?? ""}
                placeholder="Поиск: худи, джинсы, пальто…"
                className="h-10 flex-1 bg-transparent text-lg outline-none placeholder:text-neutral-400"
                aria-label="Поиск товаров"
              />
              <button className="text-[11px] font-semibold uppercase tracking-[0.2em]">Найти</button>
            </form>
          </div>
        )}
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" title="Меню">
          <nav className="flex flex-col p-6">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="border-b py-4 font-display text-2xl">
                {n.label}
              </Link>
            ))}
            <Link href="/favorites" className="border-b py-4 font-display text-2xl">
              Избранное {favorites.length > 0 && <span className="text-base text-neutral-500">({favorites.length})</span>}
            </Link>
            <Link href="/cart" className="border-b py-4 font-display text-2xl">
              Корзина {count > 0 && <span className="text-base text-neutral-500">({count})</span>}
            </Link>
            <Link href={user ? "/account" : "/login"} className="border-b py-4 font-display text-2xl">
              {user ? `Профиль · ${user.firstName}` : "Войти"}
            </Link>
            <Link href="/track" className="py-4 text-sm uppercase tracking-[0.2em] text-neutral-600">
              Отследить заказ
            </Link>
          </nav>
        </SheetContent>
      </Sheet>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent title={`Корзина${count ? ` · ${count}` : ""}`}>
          <CartDrawer onNavigate={() => setCartOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
