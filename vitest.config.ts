import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://cartes:cartes@localhost:5432/cartes_test",
      LOCAL_STORAGE_DIR: "./storage-test",
      BACKUP_DIR: "./backups-test",
      EMAIL_MODE: "log",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
      APP_URL: "http://localhost:3000",
    },
  },
});
