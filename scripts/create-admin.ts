/**
 * Create or promote a store administrator.
 *   npm run admin:create -- --email owner@damir.kz --password 'StrongPass123' [--name "Алибек"]
 * Password can also come from ADMIN_PASSWORD env to avoid shell history.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const password = arg("password") ?? process.env.ADMIN_PASSWORD;
  const name = arg("name") ?? "Admin";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Укажите --email");
  if (!password || password.length < 10) throw new Error("Пароль: минимум 10 символов (--password или ADMIN_PASSWORD)");

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash, firstName: name, role: "ADMIN" },
      update: { passwordHash, role: "ADMIN" },
    });
    await prisma.admin.upsert({ where: { userId: user.id }, create: { userId: user.id, title: "Administrator" }, update: {} });
    console.log(`✔ Администратор готов: ${email}. Вход: /admin/login`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  process.exit(1);
});
