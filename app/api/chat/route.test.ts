import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/openclaw", () => ({ getClient: vi.fn() }));
import { getClient } from "@/lib/openclaw";
import { POST } from "./route";

beforeEach(() => vi.mocked(getClient).mockReset());

async function readSse(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let out = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out += dec.decode(value);
  }
  return out;
}

describe("POST /api/chat", () => {
  it("returns 503 when no client", async () => {
    vi.mocked(getClient).mockReturnValue(null);
    const r = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ sessionId: "s", text: "hi" }) }));
    expect(r.status).toBe(503);
  });

  it("streams events as SSE frames", async () => {
    vi.mocked(getClient).mockReturnValue({
      async *sendMessage() {
        yield { type: "token", text: "hi" } as const;
        yield { type: "done" } as const;
      },
    } as never);
    const r = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ sessionId: "s", text: "hi" }) }));
    expect(r.headers.get("content-type")).toContain("text/event-stream");
    const body = await readSse(r);
    expect(body).toContain("event: token");
    expect(body).toContain('data: {"type":"token","text":"hi"}');
    expect(body).toContain("event: done");
  });

  it("rejects malformed body with 400", async () => {
    vi.mocked(getClient).mockReturnValue({} as never);
    const r = await POST(new Request("http://x", { method: "POST", body: "{}" }));
    expect(r.status).toBe(400);
  });
});
