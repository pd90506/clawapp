import { z } from "zod";
import { getClient } from "@/lib/openclaw";

const Body = z.object({ sessionId: z.string().min(1), text: z.string().min(1) });

export async function POST(req: Request) {
  const c = getClient();
  if (!c) return new Response(JSON.stringify({ error: "no-config" }), { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response(JSON.stringify({ error: "bad-body" }), { status: 400 });

  // Fire-and-forget auto-label for "New chat" sessions
  const TITLE_PLACEHOLDER = "New chat";
  const LABEL_MAX_CHARS = 40;
  (async () => {
    try {
      const sessions = await c.listSessions();
      const found = sessions.find((s) => s.id === parsed.data.sessionId);
      if (found?.title === TITLE_PLACEHOLDER) {
        const newLabel = parsed.data.text.slice(0, LABEL_MAX_CHARS);
        await c.patchSessionLabel(parsed.data.sessionId, newLabel);
      }
    } catch { /* non-fatal */ }
  })();

  const ac = new AbortController();
  req.signal.addEventListener("abort", () => ac.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const ev of c.sendMessage(parsed.data.sessionId, parsed.data.text, ac.signal)) {
          controller.enqueue(enc.encode(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`));
          if (ev.type === "done" || ev.type === "error") break;
        }
      } catch (e) {
        const msg = (e as Error).message;
        controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({ type: "error", message: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
    cancel() { ac.abort(); },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
