"use client";
import { useState } from "react";

type Props = { text: string; done: boolean };

export function ThinkingPanel({ text, done }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-2 border-l-2 border-zinc-300 dark:border-zinc-700 pl-3 text-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-zinc-500">
        {done ? "Thoughts" : "Thinking…"} {open ? "▾" : "▸"}
      </button>
      {open && <div className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{text}</div>}
    </div>
  );
}
