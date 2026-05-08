import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use a separate dist directory when running e2e tests so the dev server
  // doesn't conflict with an already-running `pnpm dev` instance.
  ...(process.env.NEXT_E2E === "1" ? { distDir: ".next-e2e" } : {}),
  ...(process.env.NEXT_PREVIEW === "1" ? { distDir: ".next-preview" } : {}),
};

export default nextConfig;
