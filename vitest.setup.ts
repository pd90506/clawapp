import "@testing-library/jest-dom/vitest";

// Node.js 25 exposes a native (non-functional) localStorage global that shadows
// jsdom's implementation. We replace it with a working in-memory Storage shim.
const createStorage = (): Storage => {
  const store: Record<string, string> = {};
  return {
    get length() { return Object.keys(store).length; },
    key(n: number) { return Object.keys(store)[n] ?? null; },
    getItem(k: string) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k: string, v: string) { store[k] = String(v); },
    removeItem(k: string) { delete store[k]; },
    clear() { for (const k of Object.keys(store)) delete store[k]; },
  };
};

// Only override if clear() is missing (i.e. Node's native stub is in place)
if (typeof globalThis.localStorage?.clear !== "function") {
  Object.defineProperty(globalThis, "localStorage", {
    value: createStorage(),
    configurable: true,
    enumerable: true,
    writable: true,
  });
}
