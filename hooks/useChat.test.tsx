import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "./useChat";

function streamFromFrames(frames: { event: string; data: unknown }[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const f of frames) {
        controller.enqueue(enc.encode(`event: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/**
 * Routes fetch calls:
 * - GET /api/sessions/<id> → returns history JSON (default empty)
 * - POST /api/chat        → returns the supplied SSE stream (fresh per call)
 */
type ThreadRow = { role: "user" | "assistant" | "system" | "divider"; text: string; at: number };

/**
 * Routes fetch calls for Model B:
 * - GET  /api/agents/<agent>/thread → stitched thread JSON ({ activeId, messages })
 * - POST /api/agents/<agent>/new    → the new active session summary ({ id })
 * - POST /api/chat                  → the supplied SSE stream (fresh per call)
 */
function routedFetch(opts: {
  thread?: { activeId: string; messages: ThreadRow[] };
  newSession?: { id: string };
  chatFrames?: { event: string; data: unknown }[];
  chatBuilder?: (init?: RequestInit) => Response;
}) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (typeof url === "string" && /\/thread$/.test(url)) {
      return Promise.resolve(new Response(JSON.stringify(opts.thread ?? { activeId: "a", messages: [] }), { status: 200 }));
    }
    if (typeof url === "string" && /\/new$/.test(url)) {
      return Promise.resolve(new Response(JSON.stringify(opts.newSession ?? { id: "agent:s1:app:s1:1000" }), { status: 200 }));
    }
    if (opts.chatBuilder) return Promise.resolve(opts.chatBuilder(init));
    return Promise.resolve(streamFromFrames(opts.chatFrames ?? []));
  });
}

beforeEach(() => { vi.unstubAllGlobals(); window.localStorage?.clear(); });

describe("useChat", () => {
  it("optimistically appends user message and streams assistant tokens", async () => {
    vi.stubGlobal("fetch", routedFetch({ chatFrames: [
      { event: "token", data: { type: "token", text: "he" } },
      { event: "token", data: { type: "token", text: "llo" } },
      { event: "done", data: { type: "done" } },
    ]}));
    const { result } = renderHook(() => useChat("s1"));
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => {
      expect(result.current.status).toBe("idle");
      const last = result.current.messages.at(-1)!;
      expect(last.role).toBe("assistant");
      expect(last.blocks).toEqual([{ kind: "text", md: "hello" }]);
    });
    expect(result.current.messages.at(-2)).toMatchObject({ role: "user", blocks: [{ kind: "text", md: "hi" }] });
  });

  it("interleaves tool_call / tool_result blocks with text", async () => {
    vi.stubGlobal("fetch", routedFetch({ chatFrames: [
      { event: "token", data: { type: "token", text: "before " } },
      { event: "tool_call", data: { type: "tool_call", id: "t1", name: "search", args: { q: "x" } } },
      { event: "tool_result", data: { type: "tool_result", id: "t1", result: "found" } },
      { event: "token", data: { type: "token", text: "after" } },
      { event: "done", data: { type: "done" } },
    ]}));
    const { result } = renderHook(() => useChat("s1"));
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => {
      const last = result.current.messages.at(-1)!;
      expect(last.blocks.map((b) => b.kind)).toEqual(["text", "tool_call", "text"]);
      expect(result.current.status).toBe("idle");
    });
  });

  it("replaces the current assistant text block on replace events", async () => {
    vi.stubGlobal("fetch", routedFetch({ chatFrames: [
      { event: "token", data: { type: "token", text: "helo" } },
      { event: "replace", data: { type: "replace", text: "hello" } },
      { event: "done", data: { type: "done" } },
    ]}));
    const { result } = renderHook(() => useChat("s1"));
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => {
      const last = result.current.messages.at(-1)!;
      expect(last.blocks).toEqual([{ kind: "text", md: "hello" }]);
      expect(result.current.status).toBe("idle");
    });
  });

  it("replace events remove stale text across tool-split assistant blocks", async () => {
    vi.stubGlobal("fetch", routedFetch({ chatFrames: [
      { event: "token", data: { type: "token", text: "prefix " } },
      { event: "tool_call", data: { type: "tool_call", id: "t1", name: "search", args: {} } },
      { event: "token", data: { type: "token", text: "helo" } },
      { event: "replace", data: { type: "replace", text: "hello" } },
      { event: "done", data: { type: "done" } },
    ]}));
    const { result } = renderHook(() => useChat("s1"));
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => {
      const last = result.current.messages.at(-1)!;
      expect(last.blocks.filter((b) => b.kind === "text")).toEqual([{ kind: "text", md: "hello" }]);
      expect(last.blocks.some((b) => b.kind === "tool_call")).toBe(true);
      expect(result.current.status).toBe("idle");
    });
  });

  it("marks message errored on error event", async () => {
    vi.stubGlobal("fetch", routedFetch({ chatFrames: [
      { event: "error", data: { type: "error", message: "boom" } },
    ]}));
    const { result } = renderHook(() => useChat("s1"));
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => {
      expect(result.current.messages.at(-1)?.error).toBe("boom");
      expect(result.current.status).toBe("error");
    });
  });

  it("aborts in-flight request when unmounted", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", routedFetch({
      chatBuilder: (init) => {
        signal = init?.signal as AbortSignal;
        const body = new ReadableStream<Uint8Array>({ start() { /* never */ } });
        return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
      },
    }));
    const { result, unmount } = renderHook(() => useChat("s1"));
    act(() => { void result.current.send("hi"); });
    await new Promise((r) => setTimeout(r, 10));
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("resets messages and aborts on sessionId change", async () => {
    vi.stubGlobal("fetch", routedFetch({ chatFrames: [
      { event: "token", data: { type: "token", text: "a" } },
      { event: "done", data: { type: "done" } },
    ]}));
    const { result, rerender } = renderHook(({ id }) => useChat(id), { initialProps: { id: "s1" } });
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => expect(result.current.messages.length).toBe(2));
    rerender({ id: "s2" });
    await waitFor(() => expect(result.current.messages).toEqual([]));
  });

  it("loads the agent's stitched thread, mapping dividers and dropping noise", async () => {
    vi.stubGlobal("fetch", routedFetch({
      thread: { activeId: "agent:s1:app:s1:9", messages: [
        { role: "user", text: "Earlier question", at: 1000 },
        { role: "assistant", text: "Earlier answer", at: 1010 },
        { role: "divider", text: "New session started", at: 0 },
        { role: "assistant", text: "", at: 1020 }, // skipped (empty)
      ]},
    }));
    const { result } = renderHook(() => useChat("agent:s1:app:s1"));
    await waitFor(() => {
      const seq = result.current.messages.map((m) =>
        m.divider ?? (m.blocks[0]?.kind === "text" ? m.blocks[0].md : undefined));
      expect(seq).toEqual(["Earlier question", "Earlier answer", "New session started"]);
    });
  });

  it("/new mints a fresh session and stitches a divider, not a chat turn", async () => {
    const fetchMock = routedFetch({
      newSession: { id: "agent:s1:app:s1:1000" },
      thread: { activeId: "agent:s1:app:s1:1000", messages: [
        { role: "user", text: "old turn", at: 1 },
        { role: "divider", text: "New session started", at: 0 },
      ]},
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useChat("agent:s1:app:s1"));
    await act(async () => { await result.current.send("/new"); });
    await waitFor(() => {
      expect(result.current.messages.some((m) => m.divider === "New session started")).toBe(true);
    });
    // The "/new" command is not echoed as a user bubble.
    expect(result.current.messages.some((m) =>
      m.blocks.some((b) => b.kind === "text" && b.md === "/new"))).toBe(false);
    // It posts to the agent's /new endpoint and never sends a chat turn.
    expect(fetchMock.mock.calls.some(([u, i]) =>
      /\/api\/agents\/s1\/new$/.test(u as string) && (i as RequestInit)?.method === "POST")).toBe(true);
    expect(fetchMock.mock.calls.some(([u]) => u === "/api/chat")).toBe(false);
  });

  it("reloads the thread when the agent changes", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      const m = url.match(/\/api\/agents\/([^/]+)\/thread$/);
      if (m) {
        callCount++;
        return Promise.resolve(new Response(JSON.stringify({
          activeId: `agent:${m[1]}:app:${m[1]}`,
          messages: [{ role: "user", text: `hello from ${m[1]}`, at: 1000 }],
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(""));
    }));
    const { result, rerender } = renderHook(({ id }) => useChat(id), { initialProps: { id: "agent:s1:app:s1" } });
    await waitFor(() => {
      expect(result.current.messages[0]?.blocks[0]).toEqual({ kind: "text", md: "hello from s1" });
    });
    rerender({ id: "agent:s2:app:s2" });
    await waitFor(() => {
      expect(result.current.messages[0]?.blocks[0]).toEqual({ kind: "text", md: "hello from s2" });
    });
    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});
