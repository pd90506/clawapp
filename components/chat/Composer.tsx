"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SlashIcon, PlusIcon, BulbIcon, StopIcon } from "@/components/shell/Icons";

type Props = { onSend: (text: string) => void; disabled: boolean; streaming?: boolean; onStop?: () => void };

export function Composer({ onSend, disabled, streaming = false, onStop }: Props) {
  const [text, setText] = useState("");
  const [model, setModel] = useState("claw-coder");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [text]);

  const ready = text.trim().length > 0 && !disabled;

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    // Shift/Alt + Enter inserts a newline
    if (e.shiftKey || e.altKey) return;
    // Cmd/Ctrl + Enter also sends
    e.preventDefault();
    submit();
  };

  return (
    <div className="composer">
      <div className="composer-inner">
        <textarea
          ref={textareaRef}
          rows={1}
          aria-label="Message input"
          placeholder={disabled ? "Gateway unavailable" : "Message OpenClaw…  (Return to send, Shift+Return for newline)"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
        />
        <div className="composer-bar">
          <button type="button" className="cbtn icon-only ghost" title="Slash command">
            <SlashIcon size={13} />
          </button>
          <button type="button" className="cbtn icon-only ghost" title="Attach">
            <PlusIcon size={14} />
          </button>
          <div className="spacer" />
          <button type="button" className="cbtn ghost icon-only" title="Hint">
            <BulbIcon size={14} />
          </button>
          <select
            className="cbtn"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{ appearance: "none", paddingRight: 22 }}
          >
            <option value="claw-coder">Claw Coder</option>
            <option value="claw-base">Claw Base</option>
            <option value="claw-fast">Claw Fast</option>
          </select>
          {streaming ? (
            <button type="button" className="send-btn streaming" onClick={onStop} aria-label="Stop streaming">
              <StopIcon size={11} /> Stop
            </button>
          ) : (
            <button
              type="button"
              className={`send-btn${ready ? " ready" : ""}`}
              onClick={() => ready && submit()}
              disabled={!ready}
              aria-label="Send message"
            >
              <span className="kbd">↵</span> Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
