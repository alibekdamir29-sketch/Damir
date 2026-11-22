import { describe, expect, it } from "vitest";
import { checkoutSchema, registerSchema } from "@/lib/validation";
import { normalizePhone, formatPrice, discountPercent, slugify } from "@/lib/utils";
import { computeDelivery, DEFAULT_SETTINGS } from "@/lib/settings";
import { canTransition } from "@/lib/orders";
import { sortSizes } from "@/lib/catalog";

describe("utils", () => {
  it("normalises KZ phones", () => {
    expect(normalizePhone("8 (701) 123-45-67")).toBe("+77011234567");
    expect(normalizePhone("+7 701 123 45 67")).toBe("+77011234567");
    expect(normalizePhone("12345")).toBeNull();
  });
  it("formats prices and discounts", () => {
    expect(formatPrice(24990)).toBe("24 990 ₸");
    expect(discountPercent(80, 100)).toBe(20);
    expect(discountPercent(100, null)).toBeNull();
  });
  it("slugifies cyrillic", () => expect(slugify("Худи Чёрный")).toBe("hudi-chernyy"));
  it("sorts sizes", () => expect(sortSizes(["L", "42", "XS", "ONE SIZE", "M", "30"])).toEqual(["XS", "M", "L", "30", "42", "ONE SIZE"]));
});

describe("checkout validation", () => {
  const base = {
    idempotencyKey: "4f0b7c0e-8a8e-4c3b-9d7e-1f1f1f1f1f1f",
    customer: { firstName: "A", lastName: "B", phone: "87011234567" },
    delivery: { type: "COURIER", city: "Алматы", street: "Абая", house: "1" },
    paymentMethod: "CASH_ON_DELIVERY",
  };
  it("accepts a valid order and normalises phone", () => {
    const r = checkoutSchema.parse(base);
    expect(r.customer.phone).toBe("+77011234567");
  });
  it("requires address for courier", () => {
    const r = checkoutSchema.safeParse({ ...base, delivery: { type: "COURIER", city: "Алматы" } });
    expect(r.success).toBe(false);
  });
  it("does not require address for pickup", () => {
    expect(checkoutSchema.safeParse({ ...base, delivery: { type: "PICKUP" } }).success).toBe(true);
  });
  it("rejects bad phone / email / payment method", () => {
    expect(checkoutSchema.safeParse({ ...base, customer: { ...base.customer, phone: "123" } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, customer: { ...base.customer, email: "nope" } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, paymentMethod: "CRYPTO" }).success).toBe(false);
  });
  it("validates registration", () => {
    expect(registerSchema.safeParse({ email: "a@b.kz", password: "short", firstName: "A" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.kz", password: "longenough", firstName: "A" }).success).toBe(true);
  });
});

describe("delivery & status rules", () => {
  it("computes courier cost, free shipping threshold and pickup", () => {
    const s = DEFAULT_SETTINGS;
    expect(computeDelivery(s, { type: "COURIER", city: "Алматы" }, 10000)).toMatchObject({ ok: true, cost: 1500 });
    expect(computeDelivery(s, { type: "COURIER", city: "Алматы" }, 60000)).toMatchObject({ ok: true, cost: 0 });
    expect(computeDelivery(s, { type: "COURIER", city: "Марс" }, 10000)).toMatchObject({ ok: false });
    expect(computeDelivery(s, { type: "PICKUP" }, 10000)).toMatchObject({ ok: true, cost: 0 });
    expect(computeDelivery({ ...s, delivery: { ...s.delivery, pickupEnabled: false } }, { type: "PICKUP" }, 1)).toMatchObject({ ok: false });
  });
  it("enforces the order status machine", () => {
    expect(canTransition("NEW", "CONFIRMED")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED")).toBe(true);
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransition("SHIPPED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "NEW")).toBe(false);
  });
});
