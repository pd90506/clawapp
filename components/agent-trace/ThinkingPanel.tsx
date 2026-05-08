"use client";
import { useState } from "react";

type Props = { text: string; done: boolean; detail?: string[] };

export function ThinkingPanel({ done, detail }: Props) {
  const [open, setOpen] = useState(false);
  const label = done ? "Thoughts" : "Thinking…";
  const hasDetail = !!(detail && detail.length > 0);
  if (!hasDetail) {
    return (
      <div className="annot">
        <span>{done ? "Thoughts" : <>{"Thinking"}<span className="thinking-cursor"></span></>}</span>
      </div>
    );
  }
  return (
    <div className={`annot thought ${open ? "open" : ""}`}>
      <button type="button" className="thought-toggle" onClick={() => setOpen((v) => !v)}>
        <span className="caret">{open ? "⌄" : "›"}</span>
        <span>{label}</span>
      </button>
      {open && (
        <ul className="thought-detail">
          {detail!.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
    </div>
  );
}
