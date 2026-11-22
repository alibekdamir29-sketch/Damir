import { AuthForm } from "@/components/store/auth-form";

export const metadata = { title: "Вход в админ-панель", robots: { index: false } };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center bg-paper-muted px-4">
      <div className="w-full max-w-sm bg-white p-8 shadow-sm">
        <p className="mb-1 text-center font-display text-3xl tracking-[0.3em]">DAMIR</p>
        <p className="eyebrow mb-8 text-center">Admin Panel</p>
        <AuthForm mode="login" next={next?.startsWith("/admin") ? next : "/admin"} admin />
      </div>
    </div>
  );
}
