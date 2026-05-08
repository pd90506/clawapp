import { z } from "zod";

export const ReqFrameSchema = z.object({
  type: z.literal("req"),
  id: z.string(),
  method: z.string(),
  params: z.unknown().optional(),
});

export const ResFrameSchema = z.object({
  type: z.literal("res"),
  id: z.string(),
  ok: z.boolean(),
  payload: z.unknown().optional(),
  error: z.object({ code: z.string().optional(), message: z.string() }).passthrough().optional(),
});

export const EventFrameSchema = z.object({
  type: z.literal("event"),
  event: z.string(),
  payload: z.unknown(),
  seq: z.number().optional(),
  stateVersion: z.number().optional(),
}).passthrough();

export const FrameSchema = z.discriminatedUnion("type", [
  ReqFrameSchema, ResFrameSchema, EventFrameSchema,
]);

export type ReqFrame = z.infer<typeof ReqFrameSchema>;
export type ResFrame = z.infer<typeof ResFrameSchema>;
export type EventFrame = z.infer<typeof EventFrameSchema>;
export type Frame = z.infer<typeof FrameSchema>;

export function parseFrame(input: unknown): Frame | null {
  const r = FrameSchema.safeParse(input);
  return r.success ? r.data : null;
}

let counter = 0;
export function makeId(): string {
  counter++;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function makeRequest(method: string, params: unknown): ReqFrame {
  return { type: "req", id: makeId(), method, params };
}
