import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    exclude: [
      "e2e/**",
      "**/node_modules/**",
      ".next/**",
      ".next-*/**",
      ".claude/**",
      "**/__tests__/fake*.ts",
      "**/__tests__/fake*.tsx",
    ],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
