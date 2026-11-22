import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminOrNull } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoutButton } from "@/components/store/logout-button";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Админ-панель", template: "%s — DAMIR Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminOrNull(); // DB-verified role check (middleware is only the first gate)
  if (!admin) redirect("/admin/login");
  return (
    <div className="min-h-screen bg-paper-muted lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b bg-ink text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0">
        <div className="flex items-center justify-between px-6 py-5 lg:block">
          <Link href="/admin" className="font-display text-2xl tracking-[0.3em]">DAMIR</Link>
          <p className="hidden text-[10px] uppercase tracking-[0.2em] text-neutral-500 lg:block">Admin Panel</p>
        </div>
        <AdminNav />
        <div className="hidden px-6 py-6 text-xs text-neutral-400 lg:absolute lg:bottom-0 lg:block">
          <p>{admin.firstName} · {admin.email}</p>
          <div className="mt-2 flex gap-3">
            <Link href="/" className="underline">Магазин</Link>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="flex justify-end border-b bg-white px-6 py-3"><LogoutButton /></div>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
