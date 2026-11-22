import { Suspense } from "react";
import { StoreProvider } from "@/components/store/store-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ChatWidget } from "@/components/ai/chat-widget";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [user, settings, categories] = await Promise.all([
    getCurrentUser(),
    getSettings(),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
  ]);
  const free = settings.delivery.freeShippingFrom;
  return (
    <StoreProvider>
      <Suspense>
        <Header
          user={user ? { firstName: user.firstName, role: user.role } : null}
          announcement={free ? `Бесплатная доставка по Казахстану от ${formatPrice(free)}` : undefined}
        />
      </Suspense>
      <main className="min-h-[60vh]">{children}</main>
      <Footer settings={settings} categories={categories} />
      <ChatWidget />
    </StoreProvider>
  );
}
