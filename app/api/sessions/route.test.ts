import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/openclaw", () => ({ getClient: vi.fn() }));
import { getClient } from "@/lib/openclaw";
import { GET as listGET, POST as listPOST } from "./route";
import { GET as historyGET } from "./[id]/route";

beforeEach(() => vi.mocked(getClient).mockReset());

describe("sessions routes", () => {
  it("list returns 503 with no config", async () => {
    vi.mocked(getClient).mockReturnValue(null);
    const r = await listGET();
    expect(r.status).toBe(503);
  });
  it("list returns sessions array", async () => {
    vi.mocked(getClient).mockReturnValue({ listSessions: async () => [{ id: "s1", title: "t" }] } as never);
    const r = await listGET();
    expect(await r.json()).toEqual({ sessions: [{ id: "s1", title: "t" }] });
  });
  it("history returns 503 with no config", async () => {
    vi.mocked(getClient).mockReturnValue(null);
    const r = await historyGET(new Request("http://x"), { params: Promise.resolve({ id: "s1" }) });
    expect(r.status).toBe(503);
  });
  it("history returns messages array", async () => {
    vi.mocked(getClient).mockReturnValue({ getHistory: async () => [{ role: "user", text: "hi", at: 1 }] } as never);
    const r = await historyGET(new Request("http://x"), { params: Promise.resolve({ id: "s1" }) });
    expect(await r.json()).toEqual({ messages: [{ role: "user", text: "hi", at: 1 }] });
  });
});

describe("POST /api/sessions", () => {
  it("returns 503 when no client", async () => {
    vi.mocked(getClient).mockReturnValue(null);
    const r = await listPOST(new Request("http://x", { method: "POST", body: "{}" }));
    expect(r.status).toBe(503);
  });
  it("creates a session with given label", async () => {
    const createSession = vi.fn(async () => ({ id: "web:abc", title: "Hello" }));
    vi.mocked(getClient).mockReturnValue({ createSession } as never);
    const r = await listPOST(new Request("http://x", { method: "POST", body: JSON.stringify({ label: "Hello" }) }));
    expect(await r.json()).toEqual({ id: "web:abc", title: "Hello" });
    expect(createSession).toHaveBeenCalledWith({ label: "Hello" });
  });
  it("creates with default label when body empty", async () => {
    const createSession = vi.fn(async () => ({ id: "web:abc", title: "New chat" }));
    vi.mocked(getClient).mockReturnValue({ createSession } as never);
    const r = await listPOST(new Request("http://x", { method: "POST", body: "{}" }));
    expect(r.status).toBe(200);
    expect(createSession).toHaveBeenCalledWith({ label: undefined });
  });
});
