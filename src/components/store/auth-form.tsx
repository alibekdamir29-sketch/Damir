"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api-client";

export function AuthForm({ mode, next = "/account", admin = false }: { mode: "login" | "register"; next?: string; admin?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "", phone: "" });
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setFieldErr({});
    setBusy(true);
    try {
      const body =
        mode === "login"
          ? { email: form.email, password: form.password }
          : { email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName || undefined, phone: form.phone || undefined };
      const r = await api<{ user: { role?: string } }>(`/api/auth/${mode}`, { method: "POST", json: body });
      if (admin && r.user.role !== "ADMIN") {
        await api("/api/auth/logout", { method: "POST" });
        setErr("У этой учётной записи нет прав администратора");
        setBusy(false);
        return;
      }
      router.push(safeNext);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setErr(e.message);
        const d = e.details as { fieldErrors?: Record<string, string[]> } | undefined;
        if (d?.fieldErrors) setFieldErr(d.fieldErrors);
      } else setErr("Ошибка сети");
      setBusy(false);
    }
  }

  const f = (k: keyof typeof form, label: string, type = "text", autoComplete?: string) => (
    <div>
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} type={type} autoComplete={autoComplete} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} aria-invalid={!!fieldErr[k]} />
      <FieldError>{fieldErr[k]?.[0]}</FieldError>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      {mode === "register" && (
        <div className="grid gap-5 sm:grid-cols-2">
          {f("firstName", "Имя *", "text", "given-name")}
          {f("lastName", "Фамилия", "text", "family-name")}
        </div>
      )}
      {f("email", "Email *", "email", "email")}
      {f("password", mode === "register" ? "Пароль * (мин. 8 символов)" : "Пароль *", "password", mode === "register" ? "new-password" : "current-password")}
      {mode === "register" && f("phone", "Телефон", "tel", "tel")}
      {err && <p className="text-sm text-red-700" role="alert">{err}</p>}
      <Button className="w-full" disabled={busy} data-testid="auth-submit">{busy ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}</Button>
      {!admin && (
        <p className="text-center text-sm text-neutral-500">
          {mode === "login" ? <>Нет аккаунта? <Link href="/register" className="text-ink underline">Регистрация</Link></> : <>Уже есть аккаунт? <Link href="/login" className="text-ink underline">Войти</Link></>}
        </p>
      )}
    </form>
  );
}
