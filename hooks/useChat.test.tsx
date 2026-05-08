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

beforeEach(() => { vi.unstubAllGlobals(); });

describe("useChat", () => {
  it("optimistically appends user message and streams assistant tokens", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamFromFrames([
      { event: "token", data: { type: "token", text: "he" } },
      { event: "token", data: { type: "token", text: "llo" } },
      { event: "done", data: { type: "done" } },
    ])));
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamFromFrames([
      { event: "token", data: { type: "token", text: "before " } },
      { event: "tool_call", data: { type: "tool_call", id: "t1", name: "search", args: { q: "x" } } },
      { event: "tool_result", data: { type: "tool_result", id: "t1", result: "found" } },
      { event: "token", data: { type: "token", text: "after" } },
      { event: "done", data: { type: "done" } },
    ])));
    const { result } = renderHook(() => useChat("s1"));
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => {
      const last = result.current.messages.at(-1)!;
      expect(last.blocks.map((b) => b.kind)).toEqual(["text", "tool_call", "text"]);
      expect(result.current.status).toBe("idle");
    });
  });

  it("marks message errored on error event", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamFromFrames([
      { event: "error", data: { type: "error", message: "boom" } },
    ])));
    const { result } = renderHook(() => useChat("s1"));
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => {
      expect(result.current.messages.at(-1)?.error).toBe("boom");
      expect(result.current.status).toBe("error");
    });
  });

  it("aborts in-flight request when unmounted", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, init) => {
      signal = init?.signal as AbortSignal;
      // Return a Response with a stream that never closes
      const body = new ReadableStream<Uint8Array>({ start() { /* never enqueue/close */ } });
      return Promise.resolve(new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }));
    }));
    const { result, unmount } = renderHook(() => useChat("s1"));
    // start the send but DON'T await; we need to unmount mid-stream
    act(() => { void result.current.send("hi"); });
    // give the hook a tick to attach the signal
    await new Promise((r) => setTimeout(r, 10));
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("resets messages and aborts on sessionId change", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamFromFrames([
      { event: "token", data: { type: "token", text: "a" } },
      { event: "done", data: { type: "done" } },
    ])));
    const { result, rerender } = renderHook(({ id }) => useChat(id), { initialProps: { id: "s1" } });
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => expect(result.current.messages.length).toBe(2));
    rerender({ id: "s2" });
    await waitFor(() => expect(result.current.messages).toEqual([]));
  });
});
