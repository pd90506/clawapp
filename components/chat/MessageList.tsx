"use client";
import { useEffect, useRef } from "react";
import type { ChatMessage, Status } from "@/hooks/useChat";
import { Message } from "./Message";
import { StreamingMessage } from "./StreamingMessage";

export function MessageList({ messages, status }: { messages: ChatMessage[]; status: Status }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  return (
    <div className="flex-1 overflow-y-auto px-4">
      {messages.map((m, i) => {
        const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
        if (isLastAssistant && status === "streaming") return <StreamingMessage key={m.id} message={m} />;
        return <Message key={m.id} message={m} />;
      })}
      <div ref={endRef} />
    </div>
  );
}
