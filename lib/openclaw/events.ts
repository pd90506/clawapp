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
