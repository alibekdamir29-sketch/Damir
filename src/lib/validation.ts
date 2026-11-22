import { z } from "zod";
import { normalizePhone } from "./utils";

export const phoneSchema = z
  .string()
  .trim()
  .min(5)
  .max(30)
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Введите номер в формате +7 XXX XXX XX XX" });
      return z.NEVER;
    }
    return p;
  });

const name = z.string().trim().min(1, "Обязательное поле").max(60);

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Неверный email").max(120),
  password: z.string().min(8, "Минимум 8 символов").max(128),
  firstName: name,
  lastName: z.string().trim().max(60).optional(),
  phone: phoneSchema.optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(1).max(128),
});

export const addToCartSchema = z.object({
  variantId: z.string().min(1).max(40),
  quantity: z.number().int().min(1).max(20),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(20).optional(),
  variantId: z.string().min(1).max(40).optional(), // switch colour/size
});

export const checkoutSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    customer: z.object({
      firstName: name,
      lastName: name,
      phone: phoneSchema,
      email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Неверный email").max(120)]).optional(),
    }),
    delivery: z.object({
      type: z.enum(["COURIER", "PICKUP"]),
      city: z.string().trim().max(60).optional(),
      street: z.string().trim().max(120).optional(),
      house: z.string().trim().max(20).optional(),
      apartment: z.string().trim().max(20).optional(),
      addressLine: z.string().trim().max(200).optional(),
      comment: z.string().trim().max(500).optional(),
    }),
    paymentMethod: z.enum(["CASH_ON_DELIVERY", "ONLINE", "BANK_TRANSFER"]),
    /** Totals the customer saw. Only used to detect price changes — never trusted. */
    expectedTotal: z.number().int().min(0).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.delivery.type === "COURIER") {
      for (const f of ["city", "street", "house"] as const) {
        if (!v.delivery[f]) ctx.addIssue({ code: "custom", path: ["delivery", f], message: "Обязательное поле" });
      }
    }
  });

export const trackSchema = z.object({ number: z.string().trim().toUpperCase().max(30), phone: phoneSchema });

export type CheckoutInput = z.infer<typeof checkoutSchema>;
