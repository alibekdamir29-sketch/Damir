import type { Metadata } from "next";
import { CartPageClient } from "@/components/checkout/cart-page";

export const metadata: Metadata = { title: "Корзина" };

export default function CartPage() {
  return <CartPageClient />;
}
