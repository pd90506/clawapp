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

  it("falls back to truncated user text when summarization is unavailable", async () => {
    // Mock has no createSession/deleteSession, so summarizeChatTitle returns null
    // and the route patches with the truncated user text.
    const patchSessionLabel = vi.fn(async () => undefined);
    vi.mocked(getClient).mockReturnValue({
      listSessions: async () => [{ id: "web:abc", title: "New chat ab12" }],
      async *sendMessage() { yield { type: "done" } as const; },
      patchSessionLabel,
    } as never);
    const r = await POST(new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ sessionId: "web:abc", text: "Hello world" }),
    }));
    const reader = r.body!.getReader(); while (!(await reader.read()).done) { /* drain */ }
    expect(patchSessionLabel).toHaveBeenCalledWith("web:abc", "Hello world");
  });

  it("uses AI summary when summarization succeeds", async () => {
    const patchSessionLabel = vi.fn(async () => undefined);
    const deleteSession = vi.fn(async () => undefined);
    let sendCall = 0;
    vi.mocked(getClient).mockReturnValue({
      listSessions: async () => [{ id: "web:abc", title: "New chat ab12" }],
      createSession: async () => ({ id: "web:summary", title: "tmp" }),
      deleteSession,
      patchSessionLabel,
      async *sendMessage() {
        sendCall++;
        if (sendCall === 1) yield { type: "done" } as const;       // primary chat
        else { yield { type: "token", text: "Refactor session label flow" } as const; yield { type: "done" } as const; } // summary
      },
    } as never);
    const r = await POST(new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ sessionId: "web:abc", text: "Hi there" }),
    }));
    const reader = r.body!.getReader(); while (!(await reader.read()).done) { /* drain */ }
    expect(patchSessionLabel).toHaveBeenCalledWith("web:abc", "Refactor session label flow");
    expect(deleteSession).toHaveBeenCalledWith("web:summary");
  });

  it("uses replaced assistant text when generating a session title", async () => {
    const patchSessionLabel = vi.fn(async () => undefined);
    let summaryPrompt = "";
    let sendCall = 0;
    vi.mocked(getClient).mockReturnValue({
      listSessions: async () => [{ id: "web:abc", title: "New chat ab12" }],
      createSession: async () => ({ id: "web:summary", title: "tmp" }),
      deleteSession: async () => undefined,
      patchSessionLabel,
      async *sendMessage(_sessionId: string, text: string) {
        sendCall++;
        if (sendCall === 1) {
          yield { type: "token", text: "helo" } as const;
          yield { type: "replace", text: "hello" } as const;
          yield { type: "done" } as const;
        } else {
          summaryPrompt = text;
          yield { type: "token", text: "Greeting" } as const;
          yield { type: "done" } as const;
        }
      },
    } as never);
    const r = await POST(new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ sessionId: "web:abc", text: "Hi there" }),
    }));
    const reader = r.body!.getReader(); while (!(await reader.read()).done) { /* drain */ }
    expect(summaryPrompt).toContain("Assistant: hello");
    expect(summaryPrompt).not.toContain("Assistant: helohello");
    expect(patchSessionLabel).toHaveBeenCalledWith("web:abc", "Greeting");
  });

  it("does NOT patch when current title doesn't match placeholder pattern", async () => {
    const patchSessionLabel = vi.fn(async () => undefined);
    vi.mocked(getClient).mockReturnValue({
      listSessions: async () => [{ id: "web:abc", title: "Already named" }],
      async *sendMessage() { yield { type: "done" } as const; },
      patchSessionLabel,
    } as never);
    const r = await POST(new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ sessionId: "web:abc", text: "Hello" }),
    }));
    const reader = r.body!.getReader(); while (!(await reader.read()).done) { /* drain */ }
    expect(patchSessionLabel).not.toHaveBeenCalled();
  });
});
