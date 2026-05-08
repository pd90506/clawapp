"use client";
import { useEffect, useRef } from "react";
import type { ChatMessage, Status } from "@/hooks/useChat";
import { Message } from "./Message";
import { StreamingMessage } from "./StreamingMessage";

type GroupedMessage = { dayLabel: string | null; message: ChatMessage };

function groupByDay(messages: ChatMessage[]): GroupedMessage[] {
  // ChatMessage doesn't carry per-message timestamps yet; day dividers are
  // rendered when dayLabel is set — infrastructure ready for future timestamps.
  return messages.map((message) => ({ dayLabel: null, message }));
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
