import { Prisma, type Season } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";

export const SORTS = ["new", "popular", "price_asc", "price_desc"] as const;
export type SortKey = (typeof SORTS)[number];

const list = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (v == null ? [] : (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean).slice(0, 20)));
const int = z.coerce.number().int().min(0).max(100_000_000).optional().catch(undefined);
const flag = z
  .union([z.string(), z.boolean()])
  .optional()
  .transform((v) => v === true || v === "1" || v === "true");

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.string().trim().max(60).optional().catch(undefined),
  minPrice: int,
  maxPrice: int,
  sizes: list,
  colors: list,
  season: z.enum(["ALL_SEASON", "SPRING_SUMMER", "AUTUMN_WINTER", "SUMMER", "WINTER"]).optional().catch(undefined),
  inStock: flag,
  sale: flag,
  isNew: flag,
  sort: z.enum(SORTS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
  pageSize: z.coerce.number().int().min(1).max(60).optional().catch(undefined),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export const productCardInclude = {
  images: { orderBy: { sortOrder: "asc" }, take: 2 },
  colors: { orderBy: { sortOrder: "asc" } },
  sizes: { orderBy: { sortOrder: "asc" } },
  category: { select: { slug: true, name: true } },
  variants: { where: { isActive: true }, include: { inventory: true } },
} satisfies Prisma.ProductInclude;

type ProductWithCard = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;

export function available(inv: { quantity: number; reserved: number } | null | undefined) {
  return inv ? Math.max(0, inv.quantity - inv.reserved) : 0;
}

export function toProductCard(p: ProductWithCard) {
  const inStockVariants = p.variants.filter((v) => available(v.inventory) > 0);
  const availableSizeIds = new Set(inStockVariants.map((v) => v.sizeId));
  const availableColorIds = new Set(inStockVariants.map((v) => v.colorId));
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    category: p.category,
    price: p.price,
    oldPrice: p.oldPrice,
    isNew: p.isNew,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? p.name })),
    colors: p.colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex, available: availableColorIds.has(c.id) })),
    sizes: p.sizes.map((s) => ({ id: s.id, label: s.label, available: availableSizeIds.has(s.id) })),
    inStock: inStockVariants.length > 0,
    totalAvailable: inStockVariants.reduce((n, v) => n + available(v.inventory), 0),
  };
}
export type ProductCard = ReturnType<typeof toProductCard>;

/** Product ids whose active variants match size/color filters and (optionally) have stock. */
async function variantFilteredIds(sizes: string[], colors: string[], inStock: boolean): Promise<string[]> {
  const conds: Prisma.Sql[] = [Prisma.sql`v.is_active = true`];
  if (sizes.length) conds.push(Prisma.sql`lower(s.label) IN (${Prisma.join(sizes.map((s) => s.toLowerCase()))})`);
  if (colors.length) conds.push(Prisma.sql`lower(c.name) IN (${Prisma.join(colors.map((c) => c.toLowerCase()))})`);
  if (inStock) conds.push(Prisma.sql`(i.quantity - i.reserved) > 0`);
  const rows = await prisma.$queryRaw<{ product_id: string }[]>`
    SELECT DISTINCT v.product_id
    FROM product_variants v
    JOIN product_sizes s ON s.id = v.size_id
    JOIN product_colors c ON c.id = v.color_id
    LEFT JOIN inventory i ON i.variant_id = v.id
    WHERE ${Prisma.join(conds, " AND ")}`;
  return rows.map((r) => r.product_id);
}

export async function listProducts(raw: unknown) {
  const q = catalogQuerySchema.parse(raw ?? {});
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 24;

  const where: Prisma.ProductWhereInput = { isActive: true, category: { isActive: true } };
  if (q.category) where.category = { slug: q.category, isActive: true };
  if (q.q) {
    const terms = q.q.split(/\s+/).filter(Boolean).slice(0, 5);
    where.AND = terms.map((t) => ({
      OR: [
        { name: { contains: t, mode: "insensitive" } },
        { description: { contains: t, mode: "insensitive" } },
        { sku: { contains: t, mode: "insensitive" } },
        { style: { contains: t, mode: "insensitive" } },
        { category: { name: { contains: t, mode: "insensitive" } } },
        { colors: { some: { name: { contains: t, mode: "insensitive" } } } },
      ],
    }));
  }
  if (q.minPrice != null || q.maxPrice != null) where.price = { gte: q.minPrice, lte: q.maxPrice };
  if (q.season) where.season = q.season as Season;
  if (q.sale) where.oldPrice = { not: null };
  if (q.isNew) where.isNew = true;
  if (q.sizes.length || q.colors.length || q.inStock) {
    where.id = { in: await variantFilteredIds(q.sizes, q.colors, q.inStock) };
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    q.sort === "price_asc"
      ? [{ price: "asc" }]
      : q.sort === "price_desc"
        ? [{ price: "desc" }]
        : q.sort === "popular"
          ? [{ popularity: "desc" }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }];

  const [total, items] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, orderBy: [...orderBy, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize, include: productCardInclude }),
  ]);
  return { items: items.map(toProductCard), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), query: q };
}

const APPAREL_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
export function sortSizes(labels: string[]) {
  const rank = (l: string) => {
    const a = APPAREL_ORDER.indexOf(l.toUpperCase());
    if (a >= 0) return a;
    const n = Number(l);
    return Number.isFinite(n) ? 100 + n : 1000;
  };
  return [...labels].sort((x, y) => rank(x) - rank(y) || x.localeCompare(y));
}

export async function getFilterOptions() {
  const [sizes, colors, priceRange, categories] = await Promise.all([
    prisma.$queryRaw<{ label: string }[]>`
      SELECT s.label, MIN(s.sort_order) AS o FROM product_sizes s JOIN products p ON p.id = s.product_id
      WHERE p.is_active GROUP BY s.label ORDER BY o, s.label`,
    prisma.$queryRaw<{ name: string; hex: string }[]>`
      SELECT DISTINCT ON (lower(c.name)) c.name, c.hex FROM product_colors c JOIN products p ON p.id = c.product_id
      WHERE p.is_active ORDER BY lower(c.name)`,
    prisma.product.aggregate({ where: { isActive: true }, _min: { price: true }, _max: { price: true } }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
  ]);
  return {
    sizes: sortSizes(sizes.map((s) => s.label)),
    colors,
    minPrice: priceRange._min.price ?? 0,
    maxPrice: priceRange._max.price ?? 0,
    categories,
  };
}

export const productDetailInclude = {
  images: { orderBy: { sortOrder: "asc" } },
  colors: { orderBy: { sortOrder: "asc" } },
  sizes: { orderBy: { sortOrder: "asc" } },
  category: { select: { slug: true, name: true } },
  variants: { where: { isActive: true }, include: { inventory: true } },
} satisfies Prisma.ProductInclude;

export async function getProductBySlug(slug: string) {
  const p = await prisma.product.findFirst({ where: { slug, isActive: true }, include: productDetailInclude });
  if (!p) return null;
  return {
    ...toProductCard({ ...p, images: p.images }),
    description: p.description,
    material: p.material,
    composition: p.composition,
    season: p.season,
    style: p.style,
    allImages: p.images.map((i) => ({ url: i.url, alt: i.alt ?? p.name, colorId: i.colorId })),
    variants: p.variants.map((v) => ({ id: v.id, colorId: v.colorId, sizeId: v.sizeId, sku: v.sku, available: available(v.inventory) })),
  };
}
export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

export async function getRecommendations(productId: string, categorySlug: string, take = 4) {
  const same = await prisma.product.findMany({
    where: { isActive: true, id: { not: productId }, category: { slug: categorySlug } },
    orderBy: { popularity: "desc" },
    take,
    include: productCardInclude,
  });
  let items = same;
  if (items.length < take) {
    const more = await prisma.product.findMany({
      where: { isActive: true, id: { notIn: [productId, ...items.map((i) => i.id)] } },
      orderBy: { popularity: "desc" },
      take: take - items.length,
      include: productCardInclude,
    });
    items = [...items, ...more];
  }
  return items.map(toProductCard);
}

export async function getProductCardsByIds(ids: string[]) {
  if (!ids.length) return [];
  const items = await prisma.product.findMany({ where: { id: { in: ids }, isActive: true }, include: productCardInclude });
  const byId = new Map(items.map((p) => [p.id, toProductCard(p)]));
  return ids.map((id) => byId.get(id)).filter((x): x is ProductCard => !!x);
}
