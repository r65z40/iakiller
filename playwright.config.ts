import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const env = {
  APP_URL: `http://localhost:${PORT}`,
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://cartes:cartes@localhost:5432/cartes_e2e",
  BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123",
  EMAIL_MODE: "log",
  LOCAL_STORAGE_DIR: "./storage-e2e",
  NODE_ENV: "development",
  AUTH_RATE_LIMIT: "off",
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: env.APP_URL,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `${env.APP_URL}/connexion`,
    reuseExistingServer: false,
    timeout: 180_000,
    env,
  },
});
