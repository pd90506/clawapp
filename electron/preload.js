// Preload runs in an isolated context before the renderer loads.
// No bridge APIs are needed yet — the renderer talks to the bundled Next server
// over HTTP exactly as it does in the browser. Add contextBridge.exposeInMainWorld
// here if the UI ever needs privileged main-process capabilities.

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("clawapp", {
  isElectron: true,
  platform: process.platform,
});
