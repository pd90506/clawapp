// Prepares the Next standalone bundle for packaging into the Electron app.
//
// Problems this solves:
//   1. `output: "standalone"` omits the static asset chunks (.next/static) and
//      the public/ folder — the Vercel runtime serves those from a CDN. A
//      self-hosted build must serve them itself, so we copy them in.
//   2. Under pnpm the standalone node_modules is a tree of SYMLINKS into a
//      bundled .pnpm store; we dereference it into real files.
//   3. electron-builder actively PRUNES any `node_modules` dir it finds in the
//      packaged tree, so we can't ship the server folder directly. Instead we
//      pack the whole dereferenced bundle into a single .tgz that the app
//      extracts to a writable userData dir on first launch (see electron/main.js).
//      That writable location also lets Next write its runtime cache.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = join(root, ".next", "standalone");
const staging = join(root, ".next", "standalone-bundled");
const tgz = join(root, ".next", "clawapp-server.tgz");

if (!existsSync(join(standalone, "server.js"))) {
  console.error(
    "[prepare-standalone] .next/standalone/server.js missing — run `next build` first."
  );
  process.exit(1);
}

// 1. Pull static + public into the standalone tree.
cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), {
  recursive: true,
});
if (existsSync(join(root, "public"))) {
  cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });
}

// 2. Dereference pnpm symlinks into real files.
rmSync(staging, { recursive: true, force: true });
cpSync(standalone, staging, { recursive: true, dereference: true });

// 3. Pack into a single archive electron-builder will ship untouched.
rmSync(tgz, { force: true });
execFileSync("tar", ["-czf", tgz, "-C", staging, "."], { stdio: "inherit" });

console.log("[prepare-standalone] packed server bundle -> .next/clawapp-server.tgz");
