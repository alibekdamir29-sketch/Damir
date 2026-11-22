/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Runs on container start (see Dockerfile). If ADMIN_EMAIL and ADMIN_PASSWORD are set and
 * that user does not exist yet, creates the store administrator. Existing users are only
 * ensured to be admins; their password is never overwritten here (use `npm run admin:create`).
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) return;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return console.warn("[bootstrap-admin] ADMIN_EMAIL is not a valid email, skipped");
  if (password.length < 10) return console.warn("[bootstrap-admin] ADMIN_PASSWORD must be at least 10 characters, skipped");

  const prisma = new PrismaClient();
  try {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12), firstName: "Admin", role: "ADMIN" } });
      console.log(`[bootstrap-admin] created administrator ${email}`);
    } else if (user.role !== "ADMIN") {
      await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    }
    await prisma.admin.upsert({ where: { userId: user.id }, create: { userId: user.id, title: "Owner" }, update: {} });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  // never block the shop from starting
  console.error("[bootstrap-admin] failed:", e && e.message);
});
