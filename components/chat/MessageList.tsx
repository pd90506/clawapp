"use client";
import { useEffect, useRef } from "react";
import type { ChatMessage, Status } from "@/hooks/useChat";
import { Message } from "./Message";
import { StreamingMessage } from "./StreamingMessage";

function formatDayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type GroupedMessage = { dayLabel: string | null; message: ChatMessage };

function groupByDay(messages: ChatMessage[]): GroupedMessage[] {
  const result: GroupedMessage[] = [];
  let lastDay = "";

  for (const m of messages) {
    // We don't have timestamps on ChatMessage, so use today as fallback.
    // Day dividers are only meaningful when messages span multiple days —
    // for now we show them based on index groups (no per-message timestamp).
    // Since ChatMessage doesn't carry a timestamp, we skip day dividers for
    // existing messages and only show one if there's a clear day boundary.
    // Simplest safe impl: never show dividers (they're only shown when relevant).
    void lastDay;
    result.push({ dayLabel: null, message: m });
  }
  return result;
}

export function MessageList({ messages, status }: { messages: ChatMessage[]; status: Status }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const grouped = groupByDay(messages);
  // Only show day divider if there are multiple distinct days —
  // since ChatMessage has no timestamp we skip for now.
  const showDividers = false;

  return (
    <div className="thread">
      <div className="thread-inner">
        {grouped.map(({ dayLabel, message }, i) => {
          const isLastAssistant = message.role === "assistant" && i === grouped.length - 1;
          const rendered = (isLastAssistant && status === "streaming")
            ? <StreamingMessage key={message.id} message={message} />
            : <Message key={message.id} message={message} />;
          return (
            <div key={message.id}>
              {showDividers && dayLabel && (
                <div className="day-divider">{dayLabel}</div>
              )}
              {rendered}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
