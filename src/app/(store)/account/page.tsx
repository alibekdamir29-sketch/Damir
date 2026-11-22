import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORDER_STATUS_LABELS, formatPrice } from "@/lib/utils";
import { LogoutButton } from "@/components/store/logout-button";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Личный кабинет" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const orders = await prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50, select: { number: true, publicToken: true, status: true, total: true, createdAt: true } });
  return (
    <div className="container max-w-4xl py-12 md:py-16">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Личный кабинет</p>
          <h1 className="h-display text-5xl">Здравствуйте, {user.firstName}</h1>
          <p className="mt-2 text-sm text-neutral-500">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {user.role === "ADMIN" && <Button asChild variant="outline" size="sm"><Link href="/admin">Админ-панель</Link></Button>}
          <LogoutButton />
        </div>
      </div>
      <p className="eyebrow mb-4">Мои заказы</p>
      {orders.length === 0 ? (
        <p className="text-neutral-500">Заказов пока нет. <Link href="/catalog" className="underline">Перейти в каталог</Link></p>
      ) : (
        <ul className="divide-y border-y">
          {orders.map((o) => (
            <li key={o.number}>
              <Link href={`/order/${o.publicToken}`} className="grid grid-cols-2 gap-2 py-4 text-sm hover:bg-paper-muted sm:grid-cols-4 sm:px-2">
                <span className="font-medium">№{o.number}</span>
                <span className="text-neutral-500">{o.createdAt.toLocaleDateString("ru-RU")}</span>
                <span>{ORDER_STATUS_LABELS[o.status]}</span>
                <span className="tabular-nums sm:text-right">{formatPrice(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
