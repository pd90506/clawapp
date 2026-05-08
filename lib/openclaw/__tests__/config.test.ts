import { describe, it, expect, vi, beforeEach } from "vitest";

const readFileSyncMock = vi.fn();

vi.mock("node:fs", () => ({
  default: { readFileSync: readFileSyncMock },
  readFileSync: readFileSyncMock,
}));

beforeEach(() => {
  vi.unstubAllEnvs();
  readFileSyncMock.mockReset();
});

describe("loadConfig", () => {
  it("reads gateway url and token from openclaw.json", async () => {
    readFileSyncMock.mockReturnValue(
      JSON.stringify({ gateway: { port: 18789, auth: { token: "tok-abc" } } })
    );
    const { loadConfig } = await import("../config");
    expect(loadConfig()).toEqual({
      url: "http://127.0.0.1:18789",
      token: "tok-abc",
      source: "file",
    });
  });

  it("reads gateway url and token from env vars (preferred over file)", async () => {
    vi.stubEnv("OPENCLAW_GATEWAY_URL", "http://127.0.0.1:9999");
    vi.stubEnv("OPENCLAW_TOKEN", "env-tok");
    const { loadConfig } = await import("../config");
    expect(loadConfig()).toEqual({
      url: "http://127.0.0.1:9999",
      token: "env-tok",
      source: "env",
    });
    expect(readFileSyncMock).not.toHaveBeenCalled();
  });

  it("returns null when neither file nor env are usable", async () => {
    readFileSyncMock.mockImplementation(() => { throw new Error("ENOENT"); });
    const { loadConfig } = await import("../config");
    expect(loadConfig()).toBeNull();
  });
});
