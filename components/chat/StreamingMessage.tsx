"use client";
import type { ChatMessage } from "@/hooks/useChat";
import { Markdown } from "@/components/render/Markdown";
import { ToolCallPanel } from "@/components/agent-trace/ToolCallPanel";
import { ThinkingPanel } from "@/components/agent-trace/ThinkingPanel";

export function StreamingMessage({ message, agentName = "Assistant", agentAvatarUrl }: { message: ChatMessage; agentName?: string; agentAvatarUrl?: string }) {
  const hasBlocks = message.blocks.length > 0;
  const avInitial = (agentName[0] ?? "?").toUpperCase();

  return (
    <div className="msg asst">
      <div className="msg-av">
        {agentAvatarUrl
          // eslint-disable-next-line @next/next/no-img-element -- local data-URL avatar; next/image optimization doesn't apply
          ? <img src={agentAvatarUrl} alt="" />
          : avInitial}
      </div>
      <div className="msg-body">
        <div className="msg-name">
          {agentName} <span className="role">streaming</span>
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
                  actor={agentName}
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
