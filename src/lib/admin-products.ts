import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { AppError, notFound } from "./errors";
import { slugify } from "./utils";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Цвет в формате #RRGGBB");

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,40}$/, "Артикул: латиница, цифры и дефис"),
    slug: z.string().trim().max(90).optional(),
    description: z.string().trim().min(10).max(5000),
    categoryId: z.string().min(1),
    price: z.number().int().min(1).max(100_000_000),
    oldPrice: z.number().int().min(1).max(100_000_000).nullable().optional(),
    material: z.string().trim().max(200).optional().nullable(),
    composition: z.string().trim().max(300).optional().nullable(),
    season: z.enum(["ALL_SEASON", "SPRING_SUMMER", "AUTUMN_WINTER", "SUMMER", "WINTER"]),
    style: z.string().trim().max(60).optional().nullable(),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    isNew: z.boolean(),
    colors: z.array(z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(40), hex })).min(1).max(20),
    sizes: z.array(z.object({ id: z.string().optional(), label: z.string().trim().min(1).max(20) })).min(1).max(30),
    images: z.array(z.object({ url: z.string().trim().min(1).max(500).refine((u) => u.startsWith("/") || u.startsWith("https://"), "Некорректный URL"), alt: z.string().max(200).optional().nullable(), colorName: z.string().max(40).optional().nullable() })).max(30),
  })
  .superRefine((v, ctx) => {
    if (v.oldPrice != null && v.oldPrice <= v.price) ctx.addIssue({ code: "custom", path: ["oldPrice"], message: "Старая цена должна быть больше текущей" });
    const cn = v.colors.map((c) => c.name.toLowerCase());
    if (new Set(cn).size !== cn.length) ctx.addIssue({ code: "custom", path: ["colors"], message: "Цвета не должны повторяться" });
    const sl = v.sizes.map((s) => s.label.toLowerCase());
    if (new Set(sl).size !== sl.length) ctx.addIssue({ code: "custom", path: ["sizes"], message: "Размеры не должны повторяться" });
  });
export type ProductInput = z.infer<typeof productInputSchema>;

function variantSku(productSku: string, color: string, size: string, idx: number) {
  const c = slugify(color).replace(/-/g, "").slice(0, 3).toUpperCase() || `C${idx}`;
  return `${productSku}-${c}-${size.replace(/\s+/g, "").toUpperCase()}`;
}

export async function saveProduct(input: ProductInput, productId?: string) {
  const slug = slugify(input.slug || input.name) || slugify(input.sku);
  try {
    return await prisma.$transaction(async (tx) => {
      const base = {
        name: input.name,
        sku: input.sku,
        slug,
        description: input.description,
        categoryId: input.categoryId,
        price: input.price,
        oldPrice: input.oldPrice ?? null,
        material: input.material || null,
        composition: input.composition || null,
        season: input.season,
        style: input.style || null,
        isActive: input.isActive,
        isFeatured: input.isFeatured,
        isNew: input.isNew,
      };
      const product = productId ? await tx.product.update({ where: { id: productId }, data: base }) : await tx.product.create({ data: base });

      // ── colours
      const existingColors = await tx.productColor.findMany({ where: { productId: product.id } });
      const keepColorIds = new Set(input.colors.map((c) => c.id).filter(Boolean));
      const removedColors = existingColors.filter((c) => !keepColorIds.has(c.id));
      // ── sizes
      const existingSizes = await tx.productSize.findMany({ where: { productId: product.id } });
      const keepSizeIds = new Set(input.sizes.map((s) => s.id).filter(Boolean));
      const removedSizes = existingSizes.filter((s) => !keepSizeIds.has(s.id));

      if (removedColors.length || removedSizes.length) {
        const reserved = await tx.inventory.aggregate({
          _sum: { reserved: true },
          where: { variant: { OR: [{ colorId: { in: removedColors.map((c) => c.id) } }, { sizeId: { in: removedSizes.map((s) => s.id) } }] } },
        });
        if ((reserved._sum.reserved ?? 0) > 0) throw new AppError("HAS_RESERVATIONS", "Нельзя удалить цвет/размер: есть зарезервированные заказы", 409);
        await tx.productColor.deleteMany({ where: { id: { in: removedColors.map((c) => c.id) } } });
        await tx.productSize.deleteMany({ where: { id: { in: removedSizes.map((s) => s.id) } } });
      }
      const colors = [];
      for (const [i, c] of input.colors.entries()) {
        const own = c.id && existingColors.some((e) => e.id === c.id);
        colors.push(
          own
            ? await tx.productColor.update({ where: { id: c.id }, data: { name: c.name, hex: c.hex, sortOrder: i } })
            : await tx.productColor.create({ data: { productId: product.id, name: c.name, hex: c.hex, sortOrder: i } }),
        );
      }
      const sizes = [];
      for (const [i, s] of input.sizes.entries()) {
        const own = s.id && existingSizes.some((e) => e.id === s.id);
        sizes.push(
          own
            ? await tx.productSize.update({ where: { id: s.id }, data: { label: s.label, sortOrder: i } })
            : await tx.productSize.create({ data: { productId: product.id, label: s.label, sortOrder: i } }),
        );
      }

      // ── variants: one per colour × size, each with an inventory row
      const variants = await tx.productVariant.findMany({ where: { productId: product.id } });
      for (const [ci, c] of colors.entries()) {
        for (const s of sizes) {
          const v = variants.find((x) => x.colorId === c.id && x.sizeId === s.id);
          const sku = variantSku(product.sku, c.name, s.label, ci);
          if (!v) {
            await tx.productVariant.create({ data: { productId: product.id, colorId: c.id, sizeId: s.id, sku, inventory: { create: { quantity: 0 } } } });
          } else if (v.sku !== sku) {
            await tx.productVariant.update({ where: { id: v.id }, data: { sku } });
          }
        }
      }

      // ── images (replaced as a list)
      await tx.productImage.deleteMany({ where: { productId: product.id } });
      for (const [i, img] of input.images.entries()) {
        const color = img.colorName ? colors.find((c) => c.name.toLowerCase() === img.colorName!.toLowerCase()) : null;
        await tx.productImage.create({ data: { productId: product.id, url: img.url, alt: img.alt || null, sortOrder: i, colorId: color?.id ?? null } });
      }
      return product;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String((e.meta as { target?: string[] })?.target ?? "");
      throw new AppError("DUPLICATE", target.includes("slug") ? "Товар с таким URL (slug) уже существует" : "Артикул уже используется", 409);
    }
    throw e;
  }
}

/** Products that were ever ordered are deactivated, not deleted, so order history stays intact. */
export async function deleteProduct(productId: string) {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!p) throw notFound("Товар");
  const reserved = await prisma.inventory.aggregate({ _sum: { reserved: true }, where: { variant: { productId } } });
  if ((reserved._sum.reserved ?? 0) > 0) throw new AppError("HAS_RESERVATIONS", "У товара есть зарезервированные заказы. Сначала завершите или отмените их.", 409);
  const ordered = await prisma.orderItem.count({ where: { productId } });
  if (ordered > 0) {
    await prisma.product.update({ where: { id: productId }, data: { isActive: false } });
    return { mode: "deactivated" as const };
  }
  await prisma.product.delete({ where: { id: productId } });
  return { mode: "deleted" as const };
}
