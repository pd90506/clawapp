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
function routedFetch(opts: {
  history?: { role: "user" | "assistant" | "system"; text: string; at: number }[];
  chatFrames?: { event: string; data: unknown }[];
  chatBuilder?: (init?: RequestInit) => Response;
}) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (typeof url === "string" && url.startsWith("/api/sessions/")) {
      return Promise.resolve(new Response(JSON.stringify({ messages: opts.history ?? [] }), { status: 200 }));
    }
    if (opts.chatBuilder) return Promise.resolve(opts.chatBuilder(init));
    return Promise.resolve(streamFromFrames(opts.chatFrames ?? []));
  });
}

beforeEach(() => { vi.unstubAllGlobals(); });

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

  it("loads chat history when sessionId is set", async () => {
    vi.stubGlobal("fetch", routedFetch({
      history: [
        { role: "user", text: "Earlier question", at: 1000 },
        { role: "assistant", text: "Earlier answer", at: 1010 },
        { role: "system", text: "tool stuff", at: 1005 },  // skipped
        { role: "assistant", text: "", at: 1020 },         // skipped (empty)
      ],
    }));
    const { result } = renderHook(() => useChat("s1"));
    await waitFor(() => {
      expect(result.current.messages.length).toBe(2);
      expect(result.current.messages[0]).toMatchObject({ role: "user", blocks: [{ kind: "text", md: "Earlier question" }] });
      expect(result.current.messages[1]).toMatchObject({ role: "assistant", blocks: [{ kind: "text", md: "Earlier answer" }] });
    });
  });

  it("loads new history when sessionId changes", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url.startsWith("/api/sessions/")) {
        callCount++;
        const id = url.replace("/api/sessions/", "");
        return Promise.resolve(new Response(JSON.stringify({
          messages: [{ role: "user", text: `hello from ${decodeURIComponent(id)}`, at: 1000 }],
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(""));
    }));
    const { result, rerender } = renderHook(({ id }) => useChat(id), { initialProps: { id: "s1" } });
    await waitFor(() => {
      expect(result.current.messages[0]?.blocks[0]).toEqual({ kind: "text", md: "hello from s1" });
    });
    rerender({ id: "s2" });
    await waitFor(() => {
      expect(result.current.messages[0]?.blocks[0]).toEqual({ kind: "text", md: "hello from s2" });
    });
    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});
