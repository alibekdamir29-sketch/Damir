import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://damir:damir@localhost:5432/damir_test?schema=public",
      AUTH_SECRET: "test-secret-test-secret-test-secret-123456",
      PAYMENT_PROVIDER: "test",
      PAYMENT_WEBHOOK_SECRET: "test-webhook-secret",
      APP_URL: "http://localhost:3000",
      NODE_ENV: "test",
    },
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
