import { beforeEach, describe, expect, it } from "vitest";
import { runTool, TOOLS } from "@/lib/ai/tools";
import { loadCart } from "@/lib/cart";
import { makeCart, makeProduct, resetDb } from "../fixtures";

beforeEach(resetDb);

describe("AI consultant tools (controlled backend functions)", () => {
  it("exposes no admin / SQL / order tools", () => {
    const names = TOOLS.map((t) => t.name);
    expect(names).toEqual(["search_products", "get_product_details", "compare_products", "get_store_info", "show_products", "get_cart", "add_to_cart"]);
  });

  it("search returns real DB data only, in stock by default", async () => {
    await makeProduct({ name: "Black Hoodie", price: 29990, stock: { M: 2, L: 0 } });
    await makeProduct({ name: "Sold Out Hoodie", stock: { M: 0 } });
    const ctx = { cartId: (await makeCart([])).id, shownProductIds: [] };
    const r = JSON.parse((await runTool("search_products", { query: "hoodie" }, ctx)).content);
    expect(r.products.map((p: { name: string }) => p.name)).toEqual(["Black Hoodie"]);
    expect(r.products[0].sizes_in_stock).toEqual(["M"]);
    expect(r.products[0].price).toBe("29 990 ₸");
  });

  it("details report exact stock per size; show_products only accepts real ids", async () => {
    const { product } = await makeProduct({ stock: { M: 2, L: 0 } });
    const ctx = { cartId: (await makeCart([])).id, shownProductIds: [] as string[] };
    const d = JSON.parse((await runTool("get_product_details", { product_id: product.id }, ctx)).content);
    expect(d.stock_by_color[0].sizes).toMatchObject([{ size: "M", available: 2 }, { size: "L", available: 0 }]);
    await runTool("show_products", { product_ids: [product.id, "fake-id-123"] }, ctx);
    expect(ctx.shownProductIds).toEqual([product.id]);
  });

  it("add_to_cart is stock-checked and invalid input is rejected", async () => {
    const { product } = await makeProduct({ stock: { M: 1, L: 0 } });
    const cart = await makeCart([]);
    const ctx = { cartId: cart.id, shownProductIds: [] };
    expect((await runTool("add_to_cart", { product_id: product.id, color: "Чёрный", size: "L", quantity: 1 }, ctx)).isError).toBe(true);
    expect((await runTool("add_to_cart", { product_id: product.id, color: "Чёрный", size: "M", quantity: 1 }, ctx)).isError).toBeFalsy();
    expect((await loadCart(cart.id)).count).toBe(1);
    expect((await runTool("add_to_cart", { product_id: product.id }, ctx)).isError).toBe(true);
    expect((await runTool("drop_tables", {}, ctx)).isError).toBe(true);
  });
});
