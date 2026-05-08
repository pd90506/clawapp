"use client";
import type { ChatMessage } from "@/hooks/useChat";
import { Markdown } from "@/components/render/Markdown";
import { ToolCallPanel } from "@/components/agent-trace/ToolCallPanel";
import { ThinkingPanel } from "@/components/agent-trace/ThinkingPanel";

export function Message({ message }: { message: ChatMessage }) {
  const align = message.role === "user" ? "items-end" : "items-start";
  return (
    <div className={`flex flex-col ${align} my-3`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
        message.role === "user" ? "bg-blue-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"
      }`}>
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
