import { z } from "zod";
import { prisma } from "./db";

export const deliveryCitySchema = z.object({
  name: z.string().trim().min(2).max(60),
  cost: z.number().int().min(0).max(1_000_000),
  etaDays: z.string().trim().max(30).default("1–3"),
});

export const settingsSchema = z.object({
  general: z.object({
    storeName: z.string().trim().min(1).max(60),
    phone: z.string().trim().max(30),
    email: z.string().trim().max(120),
    instagram: z.string().trim().max(120),
    workingHours: z.string().trim().max(120),
    address: z.string().trim().max(200),
  }),
  delivery: z.object({
    cities: z.array(deliveryCitySchema).max(100),
    freeShippingFrom: z.number().int().min(0).nullable(),
    pickupEnabled: z.boolean(),
    pickupAddress: z.string().trim().max(200),
    info: z.string().trim().max(2000),
  }),
  payments: z.object({
    cashOnDelivery: z.boolean(),
    online: z.boolean(),
    bankTransfer: z.boolean(),
    bankDetails: z.string().trim().max(1000),
  }),
  returns: z.object({ policy: z.string().trim().max(4000) }),
});

export type StoreSettings = z.infer<typeof settingsSchema>;
export type SettingsSection = keyof StoreSettings;

export const DEFAULT_SETTINGS: StoreSettings = {
  general: {
    storeName: "DAMIR",
    phone: "+7 (700) 000-00-00",
    email: "hello@damir.kz",
    instagram: "https://instagram.com/damir.store",
    workingHours: "Ежедневно 10:00–21:00",
    address: "Алматы, пр. Абая, 1",
  },
  delivery: {
    cities: [
      { name: "Алматы", cost: 1500, etaDays: "1–2" },
      { name: "Астана", cost: 2500, etaDays: "2–3" },
      { name: "Шымкент", cost: 2500, etaDays: "2–4" },
      { name: "Караганда", cost: 3000, etaDays: "3–5" },
    ],
    freeShippingFrom: 50000,
    pickupEnabled: true,
    pickupAddress: "Алматы, пр. Абая, 1 — шоурум DAMIR",
    info: "Курьерская доставка по Казахстану. Бесплатно при заказе от 50 000 ₸. Самовывоз из шоурума — бесплатно.",
  },
  payments: { cashOnDelivery: true, online: true, bankTransfer: false, bankDetails: "" },
  returns: {
    policy:
      "Возврат и обмен в течение 14 дней с момента получения, если товар не был в носке и сохранены бирки. Деньги возвращаются тем же способом, которым была произведена оплата.",
  },
};

const SECTIONS: SettingsSection[] = ["general", "delivery", "payments", "returns"];

export async function getSettings(): Promise<StoreSettings> {
  const rows = await prisma.storeSetting.findMany({ where: { key: { in: SECTIONS } } });
  const result = structuredClone(DEFAULT_SETTINGS) as StoreSettings;
  for (const row of rows) {
    const section = row.key as SettingsSection;
    const parsed = settingsSchema.shape[section].safeParse({ ...(DEFAULT_SETTINGS[section] as object), ...(row.value as object) });
    if (parsed.success) (result as Record<string, unknown>)[section] = parsed.data;
  }
  return result;
}

export async function saveSettingsSection<K extends SettingsSection>(key: K, value: StoreSettings[K]) {
  const data = settingsSchema.shape[key].parse(value);
  await prisma.storeSetting.upsert({ where: { key }, create: { key, value: data }, update: { value: data } });
}

/** Delivery cost is always computed on the server from admin-managed settings. */
export function computeDelivery(
  settings: StoreSettings,
  input: { type: "COURIER" | "PICKUP"; city?: string | null },
  subtotal: number,
): { ok: true; cost: number; methodName: string } | { ok: false; reason: string } {
  if (input.type === "PICKUP") {
    if (!settings.delivery.pickupEnabled) return { ok: false, reason: "Самовывоз сейчас недоступен" };
    return { ok: true, cost: 0, methodName: `Самовывоз: ${settings.delivery.pickupAddress}` };
  }
  const city = settings.delivery.cities.find((c) => c.name.toLowerCase() === (input.city ?? "").trim().toLowerCase());
  if (!city) return { ok: false, reason: "Доставка в этот город пока недоступна" };
  const free = settings.delivery.freeShippingFrom != null && subtotal >= settings.delivery.freeShippingFrom;
  return { ok: true, cost: free ? 0 : city.cost, methodName: `Курьер: ${city.name}` };
}
