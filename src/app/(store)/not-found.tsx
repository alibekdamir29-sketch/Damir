import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container py-32 text-center">
      <p className="eyebrow mb-4">404</p>
      <h1 className="h-display text-6xl">Страница не найдена</h1>
      <Button asChild className="mt-10"><Link href="/catalog">В каталог</Link></Button>
    </div>
  );
}
