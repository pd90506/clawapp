import { z } from "zod";
import { getClient } from "@/lib/openclaw";
import { summarizeChatTitle } from "@/lib/openclaw/summarize";

const Body = z.object({ sessionId: z.string().min(1), text: z.string().min(1) });

// Default title from createSession is "New chat <4-hex>". Match exactly so we don't
// accidentally rename a user-chosen title that happens to start with "New chat".
const PLACEHOLDER_TITLE_RE = /^New chat [0-9a-f]{4}$/;
const LABEL_FALLBACK_MAX_CHARS = 40;

export async function POST(req: Request) {
  const c = getClient();
  if (!c) return new Response(JSON.stringify({ error: "no-config" }), { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response(JSON.stringify({ error: "bad-body" }), { status: 400 });

  // Capture the pre-run label up front. Patching has to happen AFTER the run completes —
  // the gateway captures `persistedLabel = entry.label` at run start and overwrites it
  // with that snapshot when the run ends, clobbering any patch made mid-run.
  let preRunLabelMatchesPlaceholder: boolean | null = null;
  try {
    const sessions = await c.listSessions();
    const found = sessions.find((s) => s.id === parsed.data.sessionId);
    preRunLabelMatchesPlaceholder = !!found && PLACEHOLDER_TITLE_RE.test(found.title);
  } catch { /* non-fatal */ }

  const ac = new AbortController();
  req.signal.addEventListener("abort", () => ac.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (frame: { type: string } & Record<string, unknown>) =>
        controller.enqueue(enc.encode(`event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`));
      // Hold terminal frames so we can patch the label (which has to happen AFTER the run-end
      // gateway write — see lib/openclaw notes) BEFORE emitting `done`. The client uses the
      // `done` SSE event as the trigger to refetch the session list; emitting `done` first
      // would race the refetch against the rename.
      let terminal: { type: "done" | "error"; message?: string } | null = null;
      let assistantText = "";
      try {
        for await (const ev of c.sendMessage(parsed.data.sessionId, parsed.data.text, ac.signal)) {
          if (ev.type === "done" || ev.type === "error") { terminal = ev; break; }
          if (ev.type === "token") assistantText += ev.text;
          if (ev.type === "replace") assistantText = ev.text;
          send(ev as { type: string } & Record<string, unknown>);
        }
      } catch (e) {
        terminal = { type: "error", message: (e as Error).message };
      }
      if (terminal?.type === "done" && preRunLabelMatchesPlaceholder) {
        const summary = await summarizeChatTitle(c, parsed.data.text, assistantText, ac.signal);
        const newLabel = summary ?? parsed.data.text.slice(0, LABEL_FALLBACK_MAX_CHARS);
        await c.patchSessionLabel(parsed.data.sessionId, newLabel).catch(() => undefined);
      }
      send(terminal ?? { type: "error", message: "stream closed without terminal event" });
      controller.close();
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
