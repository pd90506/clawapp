"use client";
import { useState } from "react";
import type { ChatMessage } from "@/hooks/useChat";
import { Markdown } from "@/components/render/Markdown";
import { ToolCallPanel } from "@/components/agent-trace/ToolCallPanel";
import { ThinkingPanel } from "@/components/agent-trace/ThinkingPanel";

function CopyMessageButton({ blocks }: { blocks: ChatMessage["blocks"] }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    const text = blocks
      .filter((b) => b.kind === "text")
      .map((b) => (b as { kind: "text"; md: string }).md)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* ignore */ }
  };
  return (
    <button type="button" className="copy-msg" onClick={onCopy} aria-label="Copy message" title="Copy message">
      {copied ? "✓" : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="11" height="11" rx="2"/>
          <path d="M5 15V5a2 2 0 0 1 2-2h10"/>
        </svg>
      )}
    </button>
  );
}

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
        <div className="msg-actions">
          <CopyMessageButton blocks={message.blocks} />
        </div>
      </div>
    </div>
  );
}
