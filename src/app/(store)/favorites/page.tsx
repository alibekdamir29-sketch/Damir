import type { Metadata } from "next";
import { FavoritesClient } from "@/components/product/favorites-client";

export const metadata: Metadata = { title: "Избранное" };
export default function FavoritesPage() {
  return <FavoritesClient />;
}
