"use client";
import { useState } from "react";

type Props = { text: string; done: boolean };

export function ThinkingPanel({ text, done }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="thinking-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="thinking-panel-toggle"
      >
        {done ? "Thoughts" : "Thinking…"} {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="thinking-panel-body">{text}</div>
      )}
    </div>
  );
}
