import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "../db";
import { available, getProductCardsByIds, listProducts, productDetailInclude } from "../catalog";
import { addItem, loadCart } from "../cart";
import { getSettings } from "../settings";
import { AppError } from "../errors";
import { SEASON_LABELS, formatPrice } from "../utils";

/**
 * The AI consultant can ONLY reach the store through these functions.
 * They are read-only over the public catalogue, plus `add_to_cart` which goes
 * through the same validated cart service as the website (stock-checked, own cart only).
 * No SQL, no admin functions, no order creation — checkout happens in the secure UI.
 */
export type ToolContext = { cartId: string; shownProductIds: string[] };

const CATEGORY_SLUGS = ["t-shirts", "shirts", "hoodies", "sweatshirts", "jeans", "pants", "jackets", "coats", "sportswear", "shoes", "accessories"];

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_products",
    description:
      "Search the DAMIR catalogue (live database). Use for any question about what products exist, prices, colours, sizes or availability. Returns at most 8 products. Colour names are in Russian (e.g. Чёрный, Белый, Серый, Тёмно-синий, Песочный, Оливковый, Коричневый, Графит, Индиго, Молочный).",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text keywords, e.g. 'худи', 'linen shirt', 'кожаная куртка'. Optional." },
        category: { type: "string", enum: CATEGORY_SLUGS, description: "Category slug. Optional." },
        color: { type: "string", description: "Colour name in Russian, e.g. 'Чёрный'. Optional." },
        size: { type: "string", description: "Size label, e.g. 'M', '32', '42', 'ONE SIZE'. Optional." },
        min_price: { type: "integer", description: "Minimum price in tenge. Optional." },
        max_price: { type: "integer", description: "Maximum price in tenge. Optional." },
        on_sale: { type: "boolean", description: "Only discounted products. Optional." },
        in_stock_only: { type: "boolean", description: "Only products that can be bought now (default true)." },
        sort: { type: "string", enum: ["new", "popular", "price_asc", "price_desc"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_product_details",
    description:
      "Full details of one product: description, material, fabric composition, season, and exact stock per colour and size. Use before answering questions like 'is size M available in black?'.",
    input_schema: {
      type: "object",
      properties: { product_id: { type: "string" } },
      required: ["product_id"],
      additionalProperties: false,
    },
  },
  {
    name: "compare_products",
    description: "Side-by-side comparison of 2–4 products (price, material, composition, season, style, available sizes).",
    input_schema: {
      type: "object",
      properties: { product_ids: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 } },
      required: ["product_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "get_store_info",
    description: "Store policies managed by the store admin: delivery cities and prices, pickup, payment methods, returns, contacts and working hours.",
    input_schema: {
      type: "object",
      properties: { topic: { type: "string", enum: ["delivery", "payment", "returns", "contacts", "all"] } },
      required: ["topic"],
      additionalProperties: false,
    },
  },
  {
    name: "show_products",
    description:
      "Display product cards (photo, name, price, sizes, colours, link) to the customer in the chat. Call this whenever you recommend specific products. Pass ids returned by other tools only.",
    input_schema: {
      type: "object",
      properties: { product_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 } },
      required: ["product_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "get_cart",
    description: "Current contents of the customer's cart with prices and stock problems.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "add_to_cart",
    description:
      "Add a product variant to the customer's cart. Only call when the customer explicitly asked to add it AND the colour and size are known. The server checks stock. After adding, tell the customer they can finish the order on the checkout page (/checkout).",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        color: { type: "string", description: "Colour name exactly as returned by get_product_details." },
        size: { type: "string", description: "Size label exactly as returned by get_product_details." },
        quantity: { type: "integer", minimum: 1, maximum: 5 },
      },
      required: ["product_id", "color", "size", "quantity"],
      additionalProperties: false,
    },
  },
];

const id = z.string().min(1).max(40);
const schemas = {
  search_products: z.object({
    query: z.string().max(100).optional(),
    category: z.string().max(40).optional(),
    color: z.string().max(40).optional(),
    size: z.string().max(20).optional(),
    min_price: z.number().int().min(0).optional(),
    max_price: z.number().int().min(0).optional(),
    on_sale: z.boolean().optional(),
    in_stock_only: z.boolean().optional(),
    sort: z.enum(["new", "popular", "price_asc", "price_desc"]).optional(),
  }),
  get_product_details: z.object({ product_id: id }),
  compare_products: z.object({ product_ids: z.array(id).min(2).max(4) }),
  get_store_info: z.object({ topic: z.enum(["delivery", "payment", "returns", "contacts", "all"]) }),
  show_products: z.object({ product_ids: z.array(id).min(1).max(6) }),
  get_cart: z.object({}),
  add_to_cart: z.object({ product_id: id, color: z.string().max(40), size: z.string().max(20), quantity: z.number().int().min(1).max(5) }),
};

async function productDetails(productId: string) {
  const p = await prisma.product.findFirst({ where: { id: productId, isActive: true }, include: productDetailInclude });
  if (!p) return null;
  const stock = p.colors.map((c) => ({
    color: c.name,
    sizes: p.sizes
      .map((s) => {
        const v = p.variants.find((x) => x.colorId === c.id && x.sizeId === s.id);
        return { size: s.label, available: v ? available(v.inventory) : 0 };
      })
      .map((x) => ({ ...x, status: x.available === 0 ? "нет в наличии" : x.available <= 3 ? `осталось ${x.available} шт.` : "в наличии" })),
  }));
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category.name,
    price: formatPrice(p.price),
    old_price: p.oldPrice ? formatPrice(p.oldPrice) : null,
    description: p.description,
    material: p.material,
    composition: p.composition,
    season: SEASON_LABELS[p.season],
    style: p.style,
    url: `/product/${p.slug}`,
    stock_by_color: stock,
  };
}

export async function runTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<{ content: string; isError?: boolean }> {
  const schema = schemas[name as keyof typeof schemas];
  if (!schema) return { content: `Unknown tool: ${name}`, isError: true };
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) return { content: `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`, isError: true };
  const input = parsed.data as Record<string, unknown>;

  switch (name) {
    case "search_products": {
      const i = input as z.infer<typeof schemas.search_products>;
      const res = await listProducts({
        q: i.query,
        category: i.category,
        colors: i.color ? [i.color] : [],
        sizes: i.size ? [i.size] : [],
        minPrice: i.min_price,
        maxPrice: i.max_price,
        sale: i.on_sale,
        inStock: i.in_stock_only ?? true,
        sort: i.sort ?? "popular",
        pageSize: 8,
      });
      return {
        content: JSON.stringify({
          total_found: res.total,
          products: res.items.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category.name,
            price: formatPrice(p.price),
            old_price: p.oldPrice ? formatPrice(p.oldPrice) : null,
            colors_in_stock: p.colors.filter((c) => c.available).map((c) => c.name),
            sizes_in_stock: p.sizes.filter((s) => s.available).map((s) => s.label),
            in_stock: p.inStock,
            url: `/product/${p.slug}`,
          })),
        }),
      };
    }
    case "get_product_details": {
      const d = await productDetails(input.product_id as string);
      return d ? { content: JSON.stringify(d) } : { content: "Product not found or not active", isError: true };
    }
    case "compare_products": {
      const ids = input.product_ids as string[];
      const all = await Promise.all(ids.map(productDetails));
      return { content: JSON.stringify(all.filter(Boolean)) };
    }
    case "get_store_info": {
      const s = await getSettings();
      const topic = input.topic as string;
      const info: Record<string, unknown> = {};
      if (topic === "delivery" || topic === "all")
        info.delivery = {
          cities: s.delivery.cities.map((c) => ({ city: c.name, price: formatPrice(c.cost), days: c.etaDays })),
          free_shipping_from: s.delivery.freeShippingFrom ? formatPrice(s.delivery.freeShippingFrom) : null,
          pickup: s.delivery.pickupEnabled ? s.delivery.pickupAddress : "недоступен",
          notes: s.delivery.info,
        };
      if (topic === "payment" || topic === "all")
        info.payment = {
          cash_on_delivery: s.payments.cashOnDelivery,
          online_card: s.payments.online,
          bank_transfer: s.payments.bankTransfer,
          note: "Оплата производится только на странице оформления заказа. Данные карты вводятся на защищённой странице платёжного сервиса.",
        };
      if (topic === "returns" || topic === "all") info.returns = s.returns.policy;
      if (topic === "contacts" || topic === "all") info.contacts = s.general;
      return { content: JSON.stringify(info) };
    }
    case "show_products": {
      const cards = await getProductCardsByIds(input.product_ids as string[]);
      for (const c of cards) if (!ctx.shownProductIds.includes(c.id)) ctx.shownProductIds.push(c.id);
      return { content: cards.length ? `Shown ${cards.length} product card(s) to the customer.` : "None of these ids exist.", isError: cards.length === 0 };
    }
    case "get_cart": {
      const cart = await loadCart(ctx.cartId);
      return {
        content: JSON.stringify({
          items: cart.items.map((i) => ({ name: i.name, color: i.color.name, size: i.size.label, quantity: i.quantity, price: formatPrice(i.unitPrice), problem: i.issue })),
          subtotal: formatPrice(cart.subtotal),
        }),
      };
    }
    case "add_to_cart": {
      const i = input as z.infer<typeof schemas.add_to_cart>;
      const variant = await prisma.productVariant.findFirst({
        where: {
          productId: i.product_id,
          isActive: true,
          color: { name: { equals: i.color, mode: "insensitive" } },
          size: { label: { equals: i.size, mode: "insensitive" } },
        },
      });
      if (!variant) return { content: "This colour/size combination does not exist for this product.", isError: true };
      try {
        await addItem(ctx.cartId, variant.id, i.quantity);
      } catch (e) {
        if (e instanceof AppError) return { content: `Could not add: ${e.message}`, isError: true };
        throw e;
      }
      return { content: "Added to cart. The customer can review the cart at /cart and checkout at /checkout." };
    }
  }
  return { content: "Unknown tool", isError: true };
}
