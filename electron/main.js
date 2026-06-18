// Electron main process for clawapp.
//
// Dev:  loads the Next dev server (http://localhost:3000) started separately
//       via `pnpm electron:dev`.
// Prod: forks the bundled Next standalone server (resources/app/server.js) on a
//       free localhost port, waits for it to answer, then loads it in a window.
//
// The Next app's API routes proxy to the local OpenClaw gateway, which is why we
// run a real server inside Electron rather than shipping a static export.

const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const { fork, execFileSync } = require("node:child_process");

const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:3000";

// Stable port for the embedded server. The renderer's origin
// (http://127.0.0.1:<port>) is the localStorage partition key, so a RANDOM port
// each launch would strand all app-local prefs (agent names, avatars, pins,
// model choice) under the previous origin. Pin it so prefs persist across
// launches. Falls back to a free port only if this one is taken (rare — the
// single-instance lock keeps our own prior instance from holding it).
const STABLE_PORT = 47615;

/** @type {import('child_process').ChildProcess | null} */
let serverProcess = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// True if `port` is bindable on localhost right now.
function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, "127.0.0.1", () => srv.close(() => resolve(true)));
  });
}

// Prefer the stable port (keeps localStorage origin constant); fall back to a
// random free port if something else holds it, accepting that prefs won't
// persist for that session.
async function choosePort() {
  if (await isPortFree(STABLE_PORT)) return STABLE_PORT;
  return getFreePort();
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Next server did not respond within ${timeoutMs}ms`));
        } else {
          setTimeout(attempt, 300);
        }
      });
    };
    attempt();
  });
}

// The server bundle ships as a .tgz (electron-builder prunes any node_modules
// dir, so we can't ship the folder directly). Extract it once per version into a
// writable userData dir — which also gives Next a writable runtime cache — and
// return the directory containing server.js.
function ensureServerExtracted() {
  const dest = path.join(app.getPath("userData"), "server", app.getVersion());
  const serverPath = path.join(dest, "server.js");
  if (fs.existsSync(serverPath)) return dest;

  const archive = path.join(process.resourcesPath, "clawapp-server.tgz");
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  execFileSync("tar", ["-xzf", archive, "-C", dest], { stdio: "inherit" });
  return dest;
}

// Starts the bundled standalone server and resolves with its base URL.
async function startNextServer() {
  const port = await choosePort();
  const appDir = ensureServerExtracted();
  const serverPath = path.join(appDir, "server.js");

  // child_process.fork from Electron runs the script in Node mode.
  serverProcess = fork(serverPath, [], {
    cwd: appDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    },
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });

  serverProcess.on("exit", (code) => {
    if (code && code !== 0 && !app.isQuitting) {
      console.error(`Next server exited unexpectedly (code ${code})`);
    }
  });

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
}

async function createWindow() {
  let url;
  // E2E / screenshot harness: load a caller-supplied server URL directly, skipping
  // both the dev URL and the bundled-server fork. Keeps the harness hermetic and
  // lets Playwright drive the REAL Electron app (no separate browser needed).
  const e2eUrl = process.env.CLAWAPP_E2E_URL;
  if (e2eUrl) {
    // Start blank and let the Playwright harness seed localStorage (via an init
    // script, before app JS mounts) then navigate to the real server itself.
    // Avoids racing an in-flight load, and seeds prefs before the hooks read them.
    url = "about:blank";
  } else if (isDev) {
    url = DEV_URL;
    await waitForServer(url); // dev server is launched separately by electron:dev
  } else {
    url = await startNextServer();
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: "#0a0a0a",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open target=_blank / external links in the system browser, not new windows.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith("http://127.0.0.1") || target.startsWith(DEV_URL)) {
      return { action: "allow" };
    }
    shell.openExternal(target);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(url);
  if (isDev && !e2eUrl) mainWindow.webContents.openDevTools({ mode: "detach" });
}

// One instance only — a second launch should focus the existing window, not
// spawn another server that would be forced onto a different (origin-changing)
// port.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow).catch((err) => {
    console.error("Failed to start clawapp:", err);
    app.quit();
  });
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
