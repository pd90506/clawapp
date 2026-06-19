import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle (.next/standalone/server.js) so the
  // Electron build can ship a trimmed runtime instead of all of node_modules.
  output: "standalone",
  // Use a separate dist directory when running e2e tests so the dev server
  // doesn't conflict with an already-running `pnpm dev` instance.
  ...(process.env.NEXT_E2E === "1" ? { distDir: ".next-e2e" } : {}),
  ...(process.env.NEXT_PREVIEW === "1" ? { distDir: ".next-preview" } : {}),
};

export default nextConfig;
