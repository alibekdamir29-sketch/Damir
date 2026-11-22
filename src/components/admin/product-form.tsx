"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductImage } from "@/components/product/product-image";
import { api, ApiError } from "@/lib/api-client";
import { SEASON_LABELS } from "@/lib/utils";

type Form = {
  id?: string;
  name: string;
  sku: string;
  slug: string;
  description: string;
  categoryId: string;
  price: number | "";
  oldPrice: number | null | "";
  material: string;
  composition: string;
  season: string;
  style: string;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  colors: { id?: string; name: string; hex: string }[];
  sizes: { id?: string; label: string }[];
  images: { url: string; alt: string; colorName: string }[];
};

const SIZE_PRESETS: Record<string, string[]> = {
  "Одежда XS–XXL": ["XS", "S", "M", "L", "XL", "XXL"],
  "Джинсы 28–36": ["28", "30", "32", "34", "36"],
  "Обувь 39–44": ["39", "40", "41", "42", "43", "44"],
  "Один размер": ["ONE SIZE"],
};

export function ProductForm({ categories, initial }: { categories: { id: string; name: string }[]; initial?: Form }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(
    initial ?? {
      name: "",
      sku: "",
      slug: "",
      description: "",
      categoryId: categories[0]?.id ?? "",
      price: "",
      oldPrice: "",
      material: "",
      composition: "",
      season: "ALL_SEASON",
      style: "",
      isActive: true,
      isFeatured: false,
      isNew: true,
      colors: [{ name: "Чёрный", hex: "#111111" }],
      sizes: SIZE_PRESETS["Одежда XS–XXL"].map((label) => ({ label })),
      images: [],
    },
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<Record<string, string[]>>({});
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setErr(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await api<{ url: string }>("/api/admin/uploads", { method: "POST", body: fd });
        setF((x) => ({ ...x, images: [...x.images, { url: r.url, alt: x.name, colorName: "" }] }));
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setFieldErrs({});
    try {
      const body = {
        ...f,
        price: Number(f.price),
        oldPrice: f.oldPrice === "" || f.oldPrice == null ? null : Number(f.oldPrice),
        slug: f.slug || undefined,
      };
      if (f.id) await api(`/api/admin/products/${f.id}`, { method: "PUT", json: body });
      else {
        const r = await api<{ id: string }>("/api/admin/products", { method: "POST", json: body });
        router.push(`/admin/products/${r.id}`);
      }
      router.refresh();
      setErr(null);
      alertSaved();
    } catch (e) {
      if (e instanceof ApiError) {
        setErr(e.message);
        const d = e.details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | undefined;
        if (d?.fieldErrors) setFieldErrs(d.fieldErrors);
      } else setErr("Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }
  const [saved, setSaved] = useState(false);
  function alertSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function remove() {
    if (!f.id || !confirm("Удалить товар? Если товар уже заказывали, он будет скрыт, а не удалён.")) return;
    try {
      const r = await api<{ mode: string }>(`/api/admin/products/${f.id}`, { method: "DELETE" });
      if (r.mode === "deactivated") alert("Товар уже есть в заказах, поэтому он скрыт с сайта (история заказов сохранена).");
      router.push("/admin/products");
      router.refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Ошибка");
    }
  }

  const fe = (k: string) => fieldErrs[k]?.[0] && <p className="mt-1 text-xs text-red-700">{fieldErrs[k][0]}</p>;
  const move = <T,>(arr: T[], i: number, d: number) => {
    const a = [...arr];
    const j = i + d;
    if (j < 0 || j >= a.length) return a;
    [a[i], a[j]] = [a[j], a[i]];
    return a;
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <section className="space-y-4 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Label>Название *</Label><Input value={f.name} onChange={(e) => set("name", e.target.value)} data-testid="pf-name" />{fe("name")}</div>
            <div><Label>Артикул *</Label><Input value={f.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} placeholder="DM-HD-010" data-testid="pf-sku" />{fe("sku")}</div>
            <div><Label>URL (slug)</Label><Input value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder="авто из названия" /></div>
            <div><Label>Категория *</Label><NativeSelect value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></div>
            <div><Label>Сезон</Label><NativeSelect value={f.season} onChange={(e) => set("season", e.target.value)}>{Object.entries(SEASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></div>
            <div><Label>Цена, ₸ *</Label><Input inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value === "" ? "" : Number(e.target.value.replace(/\D/g, "")))} data-testid="pf-price" />{fe("price")}</div>
            <div><Label>Старая цена, ₸ (для скидки)</Label><Input inputMode="numeric" value={f.oldPrice ?? ""} onChange={(e) => set("oldPrice", e.target.value === "" ? "" : Number(e.target.value.replace(/\D/g, "")))} />{fe("oldPrice")}</div>
            <div><Label>Материал</Label><Input value={f.material} onChange={(e) => set("material", e.target.value)} /></div>
            <div><Label>Состав ткани</Label><Input value={f.composition} onChange={(e) => set("composition", e.target.value)} placeholder="100% хлопок" /></div>
            <div><Label>Стиль</Label><Input value={f.style} onChange={(e) => set("style", e.target.value)} placeholder="Minimal" /></div>
            <div className="md:col-span-2"><Label>Описание *</Label><Textarea rows={5} value={f.description} onChange={(e) => set("description", e.target.value)} data-testid="pf-description" />{fe("description")}</div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            {([["isActive", "Активен (виден на сайте)"], ["isFeatured", "Избранный (на главной)"], ["isNew", "Новинка"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-ink" checked={f[k]} onChange={(e) => set(k, e.target.checked)} />{l}</label>
            ))}
          </div>
        </section>

        <section className="space-y-4 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="eyebrow text-ink">Фотографии</h2>
            <label className="flex cursor-pointer items-center gap-2 border px-3 py-2 text-xs hover:border-ink">
              <Upload className="size-4" /> {uploading ? "Загрузка…" : "Загрузить"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
          </div>
          {f.images.length === 0 && <p className="text-sm text-neutral-500">Нет фото. JPG/PNG/WEBP до 5 МБ, рекомендуемый формат 4:5.</p>}
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {f.images.map((img, i) => (
              <li key={img.url + i} className="space-y-2 border p-2">
                <ProductImage src={img.url} alt={img.alt} className="aspect-[4/5]" />
                <select value={img.colorName} onChange={(e) => set("images", f.images.map((x, j) => (j === i ? { ...x, colorName: e.target.value } : x)))} className="w-full border px-1 py-1 text-xs">
                  <option value="">Все цвета</option>
                  {f.colors.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <div className="flex justify-between">
                  <button onClick={() => set("images", move(f.images, i, -1))} aria-label="Влево"><ArrowUp className="size-4 -rotate-90" /></button>
                  <button onClick={() => set("images", move(f.images, i, 1))} aria-label="Вправо"><ArrowDown className="size-4 -rotate-90" /></button>
                  <button onClick={() => set("images", f.images.filter((_, j) => j !== i))} aria-label="Удалить фото"><Trash2 className="size-4 text-red-700" /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="space-y-6">
        <section className="space-y-3 bg-white p-5">
          <h2 className="eyebrow text-ink">Цвета</h2>
          {f.colors.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="color" value={c.hex} onChange={(e) => set("colors", f.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)))} className="h-10 w-12 border" aria-label="Цвет" />
              <Input value={c.name} onChange={(e) => set("colors", f.colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="h-10" />
              <button onClick={() => f.colors.length > 1 && set("colors", f.colors.filter((_, j) => j !== i))} aria-label="Удалить цвет"><Trash2 className="size-4" /></button>
            </div>
          ))}
          <button className="flex items-center gap-1 text-xs underline" onClick={() => set("colors", [...f.colors, { name: "", hex: "#9A9A9A" }])}><Plus className="size-3" /> Добавить цвет</button>
          {fe("colors")}
        </section>

        <section className="space-y-3 bg-white p-5">
          <h2 className="eyebrow text-ink">Размеры</h2>
          <div className="flex flex-wrap gap-2">
            {f.sizes.map((s, i) => (
              <span key={i} className="flex items-center gap-1 border px-2 py-1 text-sm">
                <input value={s.label} onChange={(e) => set("sizes", f.sizes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="w-16 outline-none" />
                <button onClick={() => f.sizes.length > 1 && set("sizes", f.sizes.filter((_, j) => j !== i))} aria-label="Удалить размер">×</button>
              </span>
            ))}
            <button className="border border-dashed px-3 py-1 text-sm" onClick={() => set("sizes", [...f.sizes, { label: "" }])}>+</button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            Шаблоны:
            {Object.entries(SIZE_PRESETS).map(([k, v]) => (
              <button key={k} className="underline" onClick={() => set("sizes", v.map((label) => f.sizes.find((s) => s.label === label) ?? { label }))}>{k}</button>
            ))}
          </div>
          {fe("sizes")}
          <p className="text-xs text-neutral-500">Для каждой пары «цвет × размер» создаётся вариант со своим остатком. Остатки меняются в разделе «Склад».</p>
        </section>

        <section className="sticky bottom-4 space-y-3 bg-white p-5 shadow-lg">
          {err && <p className="text-sm text-red-700" role="alert">{err}</p>}
          {saved && <p className="text-sm text-emerald-700">Сохранено</p>}
          <Button className="w-full" onClick={save} disabled={busy || uploading} data-testid="pf-save">{busy ? "Сохранение…" : "Сохранить"}</Button>
          {f.id && <Button variant="ghost" className="w-full text-red-700" onClick={remove}>Удалить товар</Button>}
        </section>
      </div>
    </div>
  );
}
