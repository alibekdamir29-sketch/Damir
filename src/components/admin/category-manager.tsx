"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type Cat = { id?: string; name: string; slug: string; description: string; imageUrl: string; sortOrder: number; isActive: boolean; count?: number };

function Row({ c, onDone }: { c: Cat; onDone: () => void }) {
  const [v, setV] = useState(c);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setErr(null);
    try {
      const body = { name: v.name, slug: v.slug || undefined, description: v.description || null, imageUrl: v.imageUrl || null, sortOrder: Number(v.sortOrder) || 0, isActive: v.isActive };
      if (c.id) await api(`/api/admin/categories/${c.id}`, { method: "PUT", json: body });
      else {
        await api("/api/admin/categories", { method: "POST", json: body });
        setV({ name: "", slug: "", description: "", imageUrl: "", sortOrder: 0, isActive: true });
      }
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Ошибка");
    }
  };
  const del = async () => {
    if (!c.id || !confirm(`Удалить категорию «${c.name}»?`)) return;
    try {
      await api(`/api/admin/categories/${c.id}`, { method: "DELETE" });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Ошибка");
    }
  };
  const inp = "h-9 border px-2 text-sm";
  return (
    <tr className="border-b">
      <td className="p-2"><input className={`${inp} w-40`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Название" /></td>
      <td className="p-2"><input className={`${inp} w-36`} value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} placeholder="slug" /></td>
      <td className="p-2"><input className={`${inp} w-48`} value={v.imageUrl} onChange={(e) => setV({ ...v, imageUrl: e.target.value })} placeholder="/media/… или https://" /></td>
      <td className="p-2"><input className={`${inp} w-16`} value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value.replace(/\D/g, "")) })} /></td>
      <td className="p-2"><input type="checkbox" className="accent-ink" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} /></td>
      <td className="p-2 text-sm text-neutral-500">{c.count ?? ""}</td>
      <td className="space-x-2 p-2 text-right">
        <Button size="sm" variant="outline" onClick={save}>{c.id ? "Сохранить" : "Добавить"}</Button>
        {c.id && <Button size="sm" variant="ghost" onClick={del}>Удалить</Button>}
        {err && <p className="text-xs text-red-700">{err}</p>}
      </td>
    </tr>
  );
}

export function CategoryManager({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full min-w-[900px] text-left">
        <thead className="border-b text-[10px] uppercase tracking-[0.14em] text-neutral-500"><tr><th className="p-2">Название</th><th className="p-2">Slug</th><th className="p-2">Изображение</th><th className="p-2">Порядок</th><th className="p-2">Активна</th><th className="p-2">Товаров</th><th /></tr></thead>
        <tbody>
          {categories.map((c) => <Row key={c.id} c={c} onDone={() => router.refresh()} />)}
          <Row c={{ name: "", slug: "", description: "", imageUrl: "", sortOrder: categories.length, isActive: true }} onDone={() => router.refresh()} />
        </tbody>
      </table>
    </div>
  );
}
