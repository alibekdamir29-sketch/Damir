/**
 * Demo catalogue for DAMIR. Safe to re-run: products are upserted by SKU.
 *   npm run db:seed
 * Optional: SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD create an administrator.
 */
import { PrismaClient, type Season } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SETTINGS } from "../src/lib/settings";

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: "t-shirts", name: "T-shirts", shape: "tshirt" },
  { slug: "shirts", name: "Shirts", shape: "shirt" },
  { slug: "hoodies", name: "Hoodies", shape: "hoodie" },
  { slug: "sweatshirts", name: "Sweatshirts", shape: "sweatshirt" },
  { slug: "jeans", name: "Jeans", shape: "jeans" },
  { slug: "pants", name: "Pants", shape: "pants" },
  { slug: "jackets", name: "Jackets", shape: "jacket" },
  { slug: "coats", name: "Coats", shape: "coat" },
  { slug: "sportswear", name: "Sportswear", shape: "sport" },
  { slug: "shoes", name: "Shoes", shape: "shoes" },
  { slug: "accessories", name: "Accessories", shape: "accessories" },
] as const;

const COLOR_NAMES: Record<string, [string, string]> = {
  black: ["Чёрный", "#111111"],
  white: ["Белый", "#FAFAFA"],
  graphite: ["Графит", "#3A3A3A"],
  grey: ["Серый", "#9A9A9A"],
  sand: ["Песочный", "#CBB89A"],
  navy: ["Тёмно-синий", "#1F2A44"],
  olive: ["Оливковый", "#5B5E3C"],
  brown: ["Коричневый", "#5A3E2B"],
  indigo: ["Индиго", "#2E3A5C"],
  cream: ["Молочный", "#EFE6D6"],
};

const APPAREL = ["XS", "S", "M", "L", "XL", "XXL"];
const WAIST = ["28", "30", "32", "34", "36"];
const SHOES = ["39", "40", "41", "42", "43", "44"];

type Seed = {
  sku: string;
  name: string;
  cat: (typeof CATEGORIES)[number]["slug"];
  price: number;
  oldPrice?: number;
  colors: string[];
  sizes: string[];
  material: string;
  composition: string;
  season: Season;
  style: string;
  description: string;
  featured?: boolean;
  isNew?: boolean;
  popularity: number;
};

const PRODUCTS: Seed[] = [
  { sku: "DM-TS-001", name: "Essential Heavy T-shirt", cat: "t-shirts", price: 12990, colors: ["black", "white", "graphite"], sizes: APPAREL, material: "Хлопок плотностью 240 г/м²", composition: "100% хлопок", season: "ALL_SEASON", style: "Minimal", description: "Базовая футболка свободного кроя из плотного хлопка. Держит форму после стирок, не просвечивает. Основа любого гардероба DAMIR.", featured: true, popularity: 180 },
  { sku: "DM-TS-002", name: "Oversized Logo Tee", cat: "t-shirts", price: 14990, oldPrice: 18990, colors: ["black", "cream"], sizes: APPAREL, material: "Джерси", composition: "100% органический хлопок", season: "SPRING_SUMMER", style: "Streetwear", description: "Оверсайз-футболка с тонкой вышивкой DAMIR на груди. Спущенное плечо, удлинённая спинка.", isNew: true, popularity: 120 },
  { sku: "DM-TS-003", name: "Pima Cotton Crew", cat: "t-shirts", price: 16990, colors: ["white", "navy", "olive"], sizes: APPAREL, material: "Пима-хлопок", composition: "100% пима-хлопок", season: "SUMMER", style: "Classic", description: "Мягкая футболка прилегающего кроя из длинноволокнистого перуанского хлопка с шелковистым блеском.", popularity: 75 },
  { sku: "DM-SH-001", name: "Oxford Button-Down Shirt", cat: "shirts", price: 24990, colors: ["white", "navy"], sizes: APPAREL, material: "Оксфорд", composition: "100% хлопок", season: "ALL_SEASON", style: "Smart casual", description: "Классическая рубашка из оксфордской ткани с воротником на пуговицах. Подходит и под пиджак, и под джинсы.", featured: true, popularity: 95 },
  { sku: "DM-SH-002", name: "Linen Resort Shirt", cat: "shirts", price: 27990, oldPrice: 34990, colors: ["sand", "white", "black"], sizes: APPAREL, material: "Лён", composition: "100% лён", season: "SUMMER", style: "Resort", description: "Свободная льняная рубашка с отложным воротником. Дышит в жару и красиво мнётся.", popularity: 60 },
  { sku: "DM-SH-003", name: "Overshirt Wool Blend", cat: "shirts", price: 32990, colors: ["graphite", "brown"], sizes: APPAREL, material: "Шерстяная смесь", composition: "60% шерсть, 40% полиэстер", season: "AUTUMN_WINTER", style: "Workwear", description: "Плотная рубашка-куртка с накладными карманами. Носится как верхний слой поверх футболки или водолазки.", isNew: true, popularity: 40 },
  { sku: "DM-HD-001", name: "Signature Hoodie", cat: "hoodies", price: 29990, colors: ["black", "grey", "cream"], sizes: APPAREL, material: "Футер с начёсом", composition: "80% хлопок, 20% полиэстер", season: "ALL_SEASON", style: "Streetwear", description: "Худи плотностью 400 г/м² с двойным капюшоном и карманом-кенгуру. Фирменный силуэт DAMIR.", featured: true, popularity: 210 },
  { sku: "DM-HD-002", name: "Zip Hoodie Minimal", cat: "hoodies", price: 32990, oldPrice: 39990, colors: ["black", "navy"], sizes: APPAREL, material: "Футер трёхнитка", composition: "100% хлопок", season: "SPRING_SUMMER", style: "Minimal", description: "Худи на молнии без логотипов. Металлическая фурнитура, рибана на манжетах.", popularity: 130 },
  { sku: "DM-HD-003", name: "Heavyweight Boxy Hoodie", cat: "hoodies", price: 34990, colors: ["graphite", "olive", "black"], sizes: ["S", "M", "L", "XL"], material: "Футер 480 г/м²", composition: "100% хлопок", season: "AUTUMN_WINTER", style: "Streetwear", description: "Укороченное худи коробчатого кроя из очень плотного хлопка. Держит архитектурную форму.", isNew: true, popularity: 85 },
  { sku: "DM-SW-001", name: "Crewneck Sweatshirt", cat: "sweatshirts", price: 24990, colors: ["grey", "black", "cream"], sizes: APPAREL, material: "Футер", composition: "85% хлопок, 15% полиэстер", season: "ALL_SEASON", style: "Classic", description: "Свитшот с круглым вырезом и ребристой отделкой. Универсальный слой на каждый день.", popularity: 110 },
  { sku: "DM-SW-002", name: "Half-Zip Sweatshirt", cat: "sweatshirts", price: 27990, oldPrice: 31990, colors: ["navy", "sand"], sizes: APPAREL, material: "Футер с начёсом", composition: "90% хлопок, 10% эластан", season: "AUTUMN_WINTER", style: "Smart casual", description: "Свитшот с воротником-стойкой на короткой молнии.", popularity: 55 },
  { sku: "DM-JN-001", name: "Straight Selvedge Jeans", cat: "jeans", price: 39990, colors: ["indigo", "black"], sizes: WAIST, material: "Селвидж-деним 14 oz", composition: "100% хлопок", season: "ALL_SEASON", style: "Classic", description: "Прямые джинсы из японского селвидж-денима. Красивая кромка на подвороте и медная фурнитура.", featured: true, popularity: 150 },
  { sku: "DM-JN-002", name: "Slim Tapered Jeans", cat: "jeans", price: 34990, colors: ["black", "graphite"], sizes: WAIST, material: "Стрейч-деним", composition: "98% хлопок, 2% эластан", season: "ALL_SEASON", style: "Minimal", description: "Зауженные к низу джинсы с небольшим количеством эластана для свободы движений.", popularity: 100 },
  { sku: "DM-JN-003", name: "Wide Leg Jeans", cat: "jeans", price: 37990, oldPrice: 44990, colors: ["indigo", "cream"], sizes: WAIST, material: "Деним 12 oz", composition: "100% хлопок", season: "SPRING_SUMMER", style: "Streetwear", description: "Широкие джинсы с высокой посадкой и длинной штаниной.", isNew: true, popularity: 70 },
  { sku: "DM-PT-001", name: "Tailored Wool Trousers", cat: "pants", price: 42990, colors: ["black", "graphite", "brown"], sizes: WAIST, material: "Костюмная шерсть", composition: "98% шерсть, 2% эластан", season: "AUTUMN_WINTER", style: "Formal", description: "Брюки со стрелками прямого кроя. Внутренний пояс с силиконовой лентой, чтобы рубашка не выбивалась.", featured: true, popularity: 90 },
  { sku: "DM-PT-002", name: "Relaxed Chino", cat: "pants", price: 27990, colors: ["sand", "olive", "black"], sizes: WAIST, material: "Твил", composition: "97% хлопок, 3% эластан", season: "ALL_SEASON", style: "Smart casual", description: "Свободные чиносы с защипами. Подходят для офиса и выходных.", popularity: 115 },
  { sku: "DM-PT-003", name: "Cargo Utility Pants", cat: "pants", price: 31990, oldPrice: 38990, colors: ["olive", "black"], sizes: WAIST, material: "Рипстоп", composition: "100% хлопок", season: "SPRING_SUMMER", style: "Utility", description: "Карго-брюки с объёмными карманами и регулируемыми манжетами.", popularity: 65 },
  { sku: "DM-JK-001", name: "Leather Biker Jacket", cat: "jackets", price: 129990, colors: ["black"], sizes: APPAREL, material: "Натуральная кожа ягнёнка", composition: "Верх: 100% кожа; подкладка: 100% вискоза", season: "SPRING_SUMMER", style: "Rock", description: "Косуха из мягкой кожи ягнёнка с асимметричной молнией. Вещь, которая становится лучше с годами.", featured: true, popularity: 75 },
  { sku: "DM-JK-002", name: "Bomber Jacket", cat: "jackets", price: 49990, oldPrice: 59990, colors: ["black", "olive", "navy"], sizes: APPAREL, material: "Нейлон", composition: "100% нейлон, утеплитель 80 г/м²", season: "SPRING_SUMMER", style: "Streetwear", description: "Бомбер с лёгким утеплителем, трикотажными манжетами и карманом на рукаве.", popularity: 105 },
  { sku: "DM-JK-003", name: "Denim Trucker Jacket", cat: "jackets", price: 44990, colors: ["indigo", "black"], sizes: APPAREL, material: "Деним 13 oz", composition: "100% хлопок", season: "SPRING_SUMMER", style: "Classic", description: "Джинсовая куртка классического кроя с нагрудными клапанами.", isNew: true, popularity: 50 },
  { sku: "DM-CT-001", name: "Wool Overcoat", cat: "coats", price: 149990, colors: ["black", "graphite", "sand"], sizes: APPAREL, material: "Шерсть и кашемир", composition: "90% шерсть, 10% кашемир", season: "AUTUMN_WINTER", style: "Formal", description: "Двубортное пальто ниже колена. Мягкое плечо, полная подкладка, ручная отделка петель.", featured: true, popularity: 60 },
  { sku: "DM-CT-002", name: "Puffer Coat", cat: "coats", price: 89990, oldPrice: 109990, colors: ["black", "cream"], sizes: APPAREL, material: "Нейлон с пуховым наполнителем", composition: "Наполнитель: 90% пух, 10% перо", season: "WINTER", style: "Minimal", description: "Тёплый пуховик до середины бедра для казахстанской зимы. Выдерживает до −30 °C.", popularity: 140 },
  { sku: "DM-CT-003", name: "Trench Coat", cat: "coats", price: 99990, colors: ["sand", "black"], sizes: APPAREL, material: "Габардин", composition: "100% хлопок, водоотталкивающая пропитка", season: "SPRING_SUMMER", style: "Classic", description: "Тренч с поясом, погонами и съёмной подкладкой.", isNew: true, popularity: 45 },
  { sku: "DM-SP-001", name: "Track Jacket", cat: "sportswear", price: 34990, colors: ["black", "navy"], sizes: APPAREL, material: "Трикотаж", composition: "100% полиэстер", season: "ALL_SEASON", style: "Sport", description: "Олимпийка с контрастными лампасами на рукавах и воротником-стойкой.", popularity: 80 },
  { sku: "DM-SP-002", name: "Performance Joggers", cat: "sportswear", price: 22990, oldPrice: 27990, colors: ["black", "graphite"], sizes: APPAREL, material: "Технический трикотаж", composition: "88% полиэстер, 12% эластан", season: "ALL_SEASON", style: "Sport", description: "Джоггеры из быстросохнущей ткани с карманами на молнии.", popularity: 125 },
  { sku: "DM-SP-003", name: "Training Tee", cat: "sportswear", price: 11990, colors: ["black", "white", "grey"], sizes: APPAREL, material: "Дышащая сетка", composition: "100% переработанный полиэстер", season: "SUMMER", style: "Sport", description: "Лёгкая тренировочная футболка, отводящая влагу.", isNew: true, popularity: 70 },
  { sku: "DM-SO-001", name: "Leather Sneakers", cat: "shoes", price: 54990, colors: ["white", "black"], sizes: SHOES, material: "Гладкая кожа", composition: "Верх: кожа; подошва: резина", season: "ALL_SEASON", style: "Minimal", description: "Минималистичные кеды из итальянской кожи на прошитой резиновой подошве.", featured: true, popularity: 170 },
  { sku: "DM-SO-002", name: "Chelsea Boots", cat: "shoes", price: 69990, oldPrice: 79990, colors: ["black", "brown"], sizes: SHOES, material: "Замша", composition: "Верх: замша; подошва: резина", season: "AUTUMN_WINTER", style: "Classic", description: "Челси из замши с эластичными вставками и рифлёной подошвой.", popularity: 90 },
  { sku: "DM-SO-003", name: "Running Trainers", cat: "shoes", price: 49990, colors: ["grey", "black"], sizes: SHOES, material: "Сетка и замша", composition: "Верх: текстиль, замша; подошва: EVA", season: "SPRING_SUMMER", style: "Sport", description: "Беговые кроссовки с амортизирующей подошвой.", isNew: true, popularity: 60 },
  { sku: "DM-AC-001", name: "Leather Tote Bag", cat: "accessories", price: 59990, colors: ["black", "brown"], sizes: ["ONE SIZE"], material: "Натуральная кожа", composition: "100% кожа", season: "ALL_SEASON", style: "Minimal", description: "Вместительная сумка-тоут, в которую помещается ноутбук 15”.", featured: true, popularity: 55 },
  { sku: "DM-AC-002", name: "Wool Beanie", cat: "accessories", price: 9990, oldPrice: 12990, colors: ["black", "grey", "cream"], sizes: ["ONE SIZE"], material: "Мериносовая шерсть", composition: "100% меринос", season: "WINTER", style: "Minimal", description: "Шапка из мериноса в рубчик. Не колется.", popularity: 95 },
  { sku: "DM-AC-003", name: "Canvas Belt Bag", cat: "accessories", price: 14990, colors: ["black", "olive"], sizes: ["ONE SIZE"], material: "Плотный канвас", composition: "100% хлопок", season: "ALL_SEASON", style: "Utility", description: "Поясная сумка с регулируемым ремнём.", isNew: true, popularity: 40 },
];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Deterministic pseudo-random stock so the demo has in-stock, low and sold-out variants. */
function stockFor(sku: string, ci: number, si: number) {
  let h = 0;
  for (const ch of `${sku}:${ci}:${si}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = h % 100;
  if (r < 10) return 0; // sold out
  if (r < 25) return 1 + (h % 3); // low stock
  return 4 + (h % 18);
}

async function main() {
  for (const [i, c] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, sortOrder: i, imageUrl: `/seed/${c.shape}-black.svg` },
      update: { name: c.name, sortOrder: i },
    });
  }
  const cats = Object.fromEntries((await prisma.category.findMany()).map((c) => [c.slug, c]));

  for (const [idx, p] of PRODUCTS.entries()) {
    const shape = CATEGORIES.find((c) => c.slug === p.cat)!.shape;
    const exists = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (exists) continue; // keep admin changes on re-run
    const createdAt = new Date(Date.now() - (PRODUCTS.length - idx) * 3_600_000 * (p.isNew ? 1 : 24));
    const product = await prisma.product.create({
      data: {
        sku: p.sku,
        slug: slug(p.name),
        name: p.name,
        description: p.description,
        categoryId: cats[p.cat].id,
        price: p.price,
        oldPrice: p.oldPrice ?? null,
        material: p.material,
        composition: p.composition,
        season: p.season,
        style: p.style,
        isFeatured: !!p.featured,
        isNew: !!p.isNew,
        popularity: p.popularity,
        createdAt,
        colors: { create: p.colors.map((k, i) => ({ name: COLOR_NAMES[k][0], hex: COLOR_NAMES[k][1], sortOrder: i })) },
        sizes: { create: p.sizes.map((label, i) => ({ label, sortOrder: i })) },
      },
      include: { colors: true, sizes: true },
    });
    // images: one per colour
    for (const [i, key] of p.colors.entries()) {
      const color = product.colors.find((c) => c.name === COLOR_NAMES[key][0])!;
      await prisma.productImage.create({
        data: { productId: product.id, url: `/seed/${shape}-${key}.svg`, alt: `${p.name} — ${color.name}`, sortOrder: i, colorId: color.id },
      });
    }
    for (const [ci, color] of product.colors.entries()) {
      for (const [si, size] of product.sizes.entries()) {
        const qty = stockFor(p.sku, ci, si);
        const variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            colorId: color.id,
            sizeId: size.id,
            sku: `${p.sku}-${p.colors[ci].slice(0, 3).toUpperCase()}-${size.label.replace(/\s+/g, "")}`,
            inventory: { create: { quantity: qty } },
          },
        });
        await prisma.inventoryMovement.create({
          data: { variantId: variant.id, type: "INITIAL", quantityDelta: qty, quantityAfter: qty, reservedAfter: 0, reason: "Начальный остаток (seed)" },
        });
      }
    }
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.storeSetting.upsert({ where: { key }, create: { key, value }, update: {} });
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      create: { email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), firstName: "Admin", role: "ADMIN" },
      update: { role: "ADMIN" },
    });
    await prisma.admin.upsert({ where: { userId: user.id }, create: { userId: user.id, title: "Owner" }, update: {} });
    console.log(`Admin ready: ${email}`);
  }

  console.log(`Seed done: ${await prisma.product.count()} products, ${await prisma.productVariant.count()} variants`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
