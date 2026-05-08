import { z } from "zod";

export const StreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("token"), text: z.string() }),
  z.object({ type: z.literal("tool_call"), id: z.string(), name: z.string(), args: z.unknown() }),
  z.object({ type: z.literal("tool_result"), id: z.string(), result: z.unknown(), error: z.string().optional() }),
  z.object({ type: z.literal("thinking"), text: z.string() }),
  z.object({ type: z.literal("done") }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

export type StreamEvent = z.infer<typeof StreamEventSchema>;

export function parseStreamEvent(input: unknown): StreamEvent | null {
  const r = StreamEventSchema.safeParse(input);
  return r.success ? r.data : null;
}

const ContentBlockSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
}).passthrough();

const TranscriptMessageSchema = z.object({
  role: z.string(),
  content: z.union([z.string(), z.array(ContentBlockSchema)]).optional(),
  text: z.string().optional(),
  timestamp: z.number().optional(),
}).passthrough();

const SessionMessageEventSchema = z.object({
  sessionKey: z.string(),
  message: TranscriptMessageSchema,
  messageId: z.string().optional(),
  messageSeq: z.number().optional(),
}).passthrough();

const ToolEventDataSchema = z.object({
  phase: z.enum(["start", "result"]),
  name: z.string(),
  toolCallId: z.string(),
  args: z.unknown().optional(),
  meta: z.string().optional(),
  isError: z.boolean().optional(),
  result: z.unknown().optional(),
}).passthrough();

const SessionToolEventSchema = z.object({
  runId: z.string(),
  seq: z.number(),
  stream: z.literal("tool"),
  ts: z.number(),
  sessionKey: z.string(),
  data: ToolEventDataSchema,
}).passthrough();

const ChatEventSchema = z.object({
  runId: z.string(),
  sessionKey: z.string(),
  seq: z.number(),
  state: z.enum(["delta", "final", "aborted", "error"]),
  message: TranscriptMessageSchema.optional(),
  stopReason: z.string().optional(),
  errorMessage: z.string().optional(),
  errorKind: z.enum(["refusal", "timeout", "rate_limit", "context_length", "unknown"]).optional(),
}).passthrough();

export type SessionMessageEvent = z.infer<typeof SessionMessageEventSchema>;
export type SessionToolEvent = z.infer<typeof SessionToolEventSchema>;
export type ChatTranscriptEvent = z.infer<typeof ChatEventSchema>;

export type TranscriptEvent =
  | { kind: "message"; data: SessionMessageEvent }
  | { kind: "tool"; data: SessionToolEvent }
  | { kind: "chat"; data: ChatTranscriptEvent };

export function parseTranscriptEvent(eventName: string, payload: unknown): TranscriptEvent | null {
  if (eventName === "session.message") {
    const p = SessionMessageEventSchema.safeParse(payload);
    return p.success ? { kind: "message", data: p.data } : null;
  }
  if (eventName === "session.tool") {
    const p = SessionToolEventSchema.safeParse(payload);
    return p.success ? { kind: "tool", data: p.data } : null;
  }
  if (eventName === "chat") {
    const p = ChatEventSchema.safeParse(payload);
    return p.success ? { kind: "chat", data: p.data } : null;
  }
  return null;
}

// Helper used by the adapter to extract assistant text from a transcript message.
export function extractMessageText(message: { content?: string | { type: string; text?: string }[]; text?: string }): string {
  if (typeof message.text === "string") return message.text;
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
  }
  return "";
}
