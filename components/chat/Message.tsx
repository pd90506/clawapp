"use client";
import type { ChatMessage } from "@/hooks/useChat";
import { Markdown } from "@/components/render/Markdown";
import { ToolCallPanel } from "@/components/agent-trace/ToolCallPanel";
import { ThinkingPanel } from "@/components/agent-trace/ThinkingPanel";

export function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const align = isUser ? "items-end" : "items-start";
  const bubble = isUser
    ? "bg-[var(--accent-soft)] text-[var(--accent)] rounded-2xl px-4 py-2"
    : "bg-transparent text-[var(--text-primary)]";
  return (
    <div className={`flex flex-col ${align} my-3 px-6`}>
      <div className={`max-w-[80%] ${bubble}`}>
        {message.blocks.map((b, i) => {
          if (b.kind === "text") return <Markdown key={i} md={b.md} />;
          if (b.kind === "tool_call") return (
            <ToolCallPanel key={i} name={b.name} args={b.args} done={b.done} result={b.result} error={b.error} />
          );
          return <ThinkingPanel key={i} text={b.text} done={b.done} />;
        })}
        {message.error && <div className="text-sm text-red-500 mt-2">Error: {message.error}</div>}
      </div>
    </div>
  );
}
