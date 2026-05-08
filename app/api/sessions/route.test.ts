import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/openclaw", () => ({ getClient: vi.fn() }));
import { getClient } from "@/lib/openclaw";
import { GET as listGET } from "./route";
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
