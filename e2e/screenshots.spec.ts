import { test, _electron as electron, type Page } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

// On-demand visual capture harness — drives the REAL Electron app (not a headless
// browser) and writes PNGs to e2e/screens/ so a human or agent can eyeball the UI
// without manually taking screenshots every time.
//
//   pnpm screenshots
//
// Playwright launches Electron itself (the binary already in node_modules — no
// Chromium download), pointed at the same fake gateway + Next dev server the other
// e2e specs use (started by playwright.config webServer). main.js honours
// CLAWAPP_E2E_URL to load that server directly.

const OUT = path.join(__dirname, "screens");
const APP_URL = "http://localhost:3099"; // matches APP_PORT in playwright.config.ts
const REPO_ROOT = path.join(__dirname, "..");

// Real Silver Wolf avatar (256×256 JPEG fixture) — read at runtime and inlined as
// a data URI, fills the avatar circle via `object-fit: cover`. A representative
// image proves the chat header reads the stored avatar, not the letter fallback.
const AVATAR = `data:image/jpeg;base64,${fs
  .readFileSync(path.join(__dirname, "fixtures", "silver-wolf-avatar.jpg"))
  .toString("base64")}`;

const SEED = `
  localStorage.setItem('clawapp.agentNames', JSON.stringify({ 'silver-wolf': 'Silver Wolf 🐺', main: 'Stelle' }));
  localStorage.setItem('clawapp.agentAvatars', JSON.stringify({ 'silver-wolf': '${AVATAR}', main: '${AVATAR}' }));
`;

test("capture: sidebar, chat header, streamed reply", async () => {
  // Isolated profile dir → own single-instance lock + storage, so the harness
  // doesn't collide with (or quit against) the user's running packaged app.
  const profile = path.join(os.tmpdir(), "clawapp-e2e-profile");
  const app = await electron.launch({
    args: [REPO_ROOT, `--user-data-dir=${profile}`],
    env: { ...process.env, CLAWAPP_E2E_URL: APP_URL },
  });

  const window: Page = await app.firstWindow(); // opens on about:blank in E2E mode

  // Seed the app-local nickname + avatar BEFORE app JS runs, then navigate to the
  // real server — so the hooks read the seeded prefs at first mount.
  await window.addInitScript(SEED);
  await window.goto(APP_URL, { waitUntil: "domcontentloaded" });

  // Sidebar: title = nickname, subtitle = real agent id, avatars rendered.
  await window.locator(".convo").first().waitFor({ timeout: 15_000 });
  await window.screenshot({ path: path.join(OUT, "01-sidebar.png") });

  // Open Silver Wolf's chat (subtitle still carries the real agent id).
  await window.getByText("silver-wolf", { exact: true }).click({ timeout: 10_000 });
  const composer = window.getByRole("textbox", { name: "Message input" });
  await composer.waitFor({ state: "visible", timeout: 15_000 });

  // Loaded history — assistant rows should show name "Silver Wolf 🐺" + avatar.
  await window.screenshot({ path: path.join(OUT, "02-chat-history.png") });

  // Send a message and capture the streamed assistant reply (name + avatar + tool).
  await composer.fill("show me the avatar and name");
  await window.getByRole("button", { name: /send/i }).click();
  await window.getByText(/hello world/).waitFor({ timeout: 10_000 });
  await window.screenshot({ path: path.join(OUT, "03-chat-reply.png") });

  await app.close();
});
