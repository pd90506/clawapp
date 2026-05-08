"use client";
import { useState, type KeyboardEvent } from "react";

type Props = { onSend: (text: string) => void; disabled: boolean };

export function Composer({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); }
  };
  return (
    <div className="border-t p-3 flex gap-2">
      <textarea
        className="flex-1 resize-none rounded-md border p-2 bg-transparent disabled:opacity-50"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={disabled ? "Gateway unavailable" : "Message… (⌘/Ctrl-Enter to send)"}
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !text.trim()}
        className="px-4 rounded-md bg-blue-600 text-white disabled:opacity-50"
      >
        Send
      </button>
    </div>
  );
}
