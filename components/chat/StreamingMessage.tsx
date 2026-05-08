"use client";
import type { ChatMessage } from "@/hooks/useChat";
import { Message } from "./Message";

export function StreamingMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="relative">
      <Message message={message} />
      <span className="absolute bottom-1 left-8 text-xs text-[var(--text-faint)] animate-pulse">streaming…</span>
    </div>
  );
}
