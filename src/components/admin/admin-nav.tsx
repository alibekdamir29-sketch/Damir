"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutDashboard, Settings, Shirt, ShoppingCart, Tags } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Заказы", icon: ShoppingCart },
  { href: "/admin/products", label: "Товары", icon: Shirt },
  { href: "/admin/inventory", label: "Склад", icon: Boxes },
  { href: "/admin/categories", label: "Категории", icon: Tags },
  { href: "/admin/settings", label: "Настройки", icon: Settings },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:pb-0">
      {ITEMS.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={cn("flex shrink-0 items-center gap-3 px-3 py-2.5 text-sm", active ? "bg-white text-ink" : "text-neutral-300 hover:bg-white/10")}>
            <i.icon className="size-4" /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
