import { execSync } from "child_process";

/** Applies pending migrations to the dedicated test database (tables are truncated per test in fixtures). */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://damir:damir@localhost:5432/damir_test?schema=public";
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
