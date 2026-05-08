"use client";
import { useState, type KeyboardEvent } from "react";

type Props = { onSend: (text: string) => void; disabled: boolean; modelLabel?: string };

export function Composer({ onSend, disabled, modelLabel }: Props) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    // Shift/Alt + Enter inserts a newline; Enter (and ⌘/Ctrl-Enter) sends.
    if (e.shiftKey || e.altKey) return;
    e.preventDefault();
    submit();
  };
  return (
    <div className="px-6 pb-6">
      <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-soft)] p-3 shadow-sm">
        <textarea
          className="w-full resize-none bg-transparent outline-none text-sm placeholder:text-[var(--text-faint)] disabled:opacity-50"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={disabled ? "Gateway unavailable" : "Type a message… (Enter to send · Shift-Enter for new line)"}
        />
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[var(--text-faint)]">{modelLabel ?? ""}</span>
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !text.trim()}
            className="px-3 py-1.5 rounded-full bg-[var(--accent)] text-white text-sm disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
