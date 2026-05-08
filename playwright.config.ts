import { defineConfig } from "@playwright/test";

const PORT = 39789;
const TOKEN = "test-token";
const APP_PORT = 3099;

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: `http://localhost:${APP_PORT}` },
  webServer: {
    command: `pnpm dev -p ${APP_PORT}`,
    url: `http://localhost:${APP_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEXT_E2E: "1",
      OPENCLAW_GATEWAY_URL: `http://127.0.0.1:${PORT}`,
      OPENCLAW_TOKEN: TOKEN,
    },
  },
});
