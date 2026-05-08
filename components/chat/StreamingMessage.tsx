"use client";
import type { ChatMessage } from "@/hooks/useChat";
import { Markdown } from "@/components/render/Markdown";
import { ToolCallPanel } from "@/components/agent-trace/ToolCallPanel";
import { ThinkingPanel } from "@/components/agent-trace/ThinkingPanel";

export function StreamingMessage({ message }: { message: ChatMessage }) {
  const hasBlocks = message.blocks.length > 0;

  return (
    <div className="msg asst">
      <div className="msg-av">O</div>
      <div className="msg-body">
        <div className="msg-name">
          OpenClaw <span className="role">streaming</span>
        </div>
        {hasBlocks ? (
          message.blocks.map((b, i) => {
            if (b.kind === "thinking") {
              return <ThinkingPanel key={i} text={b.text} done={b.done} />;
            }
            if (b.kind === "tool_call") {
              return (
                <ToolCallPanel
                  key={i}
                  name={b.name}
                  args={b.args}
                  done={b.done}
                  result={b.result}
                  error={b.error}
                />
              );
            }
            if (b.kind === "text") {
              return (
                <div key={i} className="asst-text">
                  <Markdown md={b.md} />
                  <span className="thinking-cursor" />
                </div>
              );
            }
            return null;
          })
        ) : (
          <div className="annot">
            Thinking<span className="thinking-cursor" />
          </div>
        )}
      </div>
    </div>
  );
}
