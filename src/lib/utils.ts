import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 24990 -> "24 990 ₸" */
export function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value).replace(/ /g, " ")} ₸`;
}

export function discountPercent(price: number, oldPrice?: number | null): number | null {
  if (!oldPrice || oldPrice <= price) return null;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

export function slugify(input: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
    н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ә: "a", ғ: "g", қ: "k", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
  };
  return input
    .toLowerCase()
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Normalises Kazakhstan phone numbers to +7XXXXXXXXXX. Returns null if invalid. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let d = digits;
  if (d.length === 11 && (d.startsWith("8") || d.startsWith("7"))) d = d.slice(1);
  if (d.length !== 10) return null;
  return `+7${d}`;
}

export const SEASON_LABELS: Record<string, string> = {
  ALL_SEASON: "Всесезон",
  SPRING_SUMMER: "Весна–лето",
  AUTUMN_WINTER: "Осень–зима",
  SUMMER: "Лето",
  WINTER: "Зима",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: "Новый заказ",
  CONFIRMED: "Подтверждён",
  PAYMENT_PENDING: "Ожидает оплаты",
  PAID: "Оплачен",
  PROCESSING: "Собирается",
  SHIPPED: "Отправлен",
  DELIVERED: "Доставлен",
  CANCELLED: "Отменён",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: "Оплата при получении",
  ONLINE: "Онлайн-оплата картой",
  BANK_TRANSFER: "Банковский перевод",
};
