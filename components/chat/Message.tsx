"use client";
import type { ChatMessage } from "@/hooks/useChat";
import { Markdown } from "@/components/render/Markdown";
import { ToolCallPanel } from "@/components/agent-trace/ToolCallPanel";
import { ThinkingPanel } from "@/components/agent-trace/ThinkingPanel";

export function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    // User message: right-aligned bubble + avatar
    const userInitial = "P"; // placeholder — no user profile in this app
    return (
      <div className="msg user">
        <div className="msg-row">
          <div>
            {message.blocks.map((b, i) => {
              if (b.kind === "text") {
                return (
                  <div key={i} className="bubble">
                    <Markdown md={b.md} />
                  </div>
                );
              }
              return null;
            })}
            {message.error && (
              <div className="bubble" style={{ color: "var(--err)", background: "transparent" }}>
                Error: {message.error}
              </div>
            )}
          </div>
          <div className="msg-av user">{userInitial}</div>
        </div>
      </div>
    );
  }

  // Assistant message: avatar + body (no bubble, plain prose)
  return (
    <div className="msg asst">
      <div className="msg-av">O</div>
      <div className="msg-body">
        <div className="msg-name">OpenClaw</div>
        {message.blocks.map((b, i) => {
          if (b.kind === "thinking") {
            return <ThinkingPanel key={i} text={b.text} done={b.done} detail={b.detail} />;
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
              </div>
            );
          }
          return null;
        })}
        {message.error && (
          <div className="annot" style={{ color: "var(--err)" }}>
            Error: {message.error}
          </div>
        )}
      </div>
    </div>
  );
}
