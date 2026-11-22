/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Runs on container start (see Dockerfile).
 * 1. On an empty database, creates the 11 standard DAMIR categories (editable in /admin/categories).
 * 2. If ADMIN_EMAIL and ADMIN_PASSWORD are set and
 * that user does not exist yet, creates the store administrator. Existing users are only
 * ensured to be admins; their password is never overwritten here (use `npm run admin:create`).
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const CATEGORIES = [
  ["t-shirts", "T-shirts", "tshirt"],
  ["shirts", "Shirts", "shirt"],
  ["hoodies", "Hoodies", "hoodie"],
  ["sweatshirts", "Sweatshirts", "sweatshirt"],
  ["jeans", "Jeans", "jeans"],
  ["pants", "Pants", "pants"],
  ["jackets", "Jackets", "jacket"],
  ["coats", "Coats", "coat"],
  ["sportswear", "Sportswear", "sport"],
  ["shoes", "Shoes", "shoes"],
  ["accessories", "Accessories", "accessories"],
];

async function ensureCategories(prisma) {
  if ((await prisma.category.count()) > 0) return;
  await prisma.category.createMany({
    data: CATEGORIES.map(([slug, name, shape], i) => ({
      slug,
      name,
      sortOrder: i,
      imageUrl: `/seed/${shape}-black.svg`,
    })),
    skipDuplicates: true,
  });
  console.log("[bootstrap] created default categories");
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await ensureCategories(prisma);
    await ensureAdmin(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function ensureAdmin(prisma) {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) return;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return console.warn(
      "[bootstrap-admin] ADMIN_EMAIL is not a valid email, skipped",
    );
  if (password.length < 10)
    return console.warn(
      "[bootstrap-admin] ADMIN_PASSWORD must be at least 10 characters, skipped",
    );

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        firstName: "Admin",
        role: "ADMIN",
      },
    });
    console.log(`[bootstrap-admin] created administrator ${email}`);
  } else if (user.role !== "ADMIN") {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
  }
  await prisma.admin.upsert({
    where: { userId: user.id },
    create: { userId: user.id, title: "Owner" },
    update: {},
  });
}

main().catch((e) => {
  // never block the shop from starting
  console.error("[bootstrap-admin] failed:", e && e.message);
});
