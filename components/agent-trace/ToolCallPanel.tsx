"use client";
import { useState } from "react";

type Props = { name: string; args: unknown; done: boolean; result?: unknown; error?: string };

export function ToolCallPanel({ name, args, done, result, error }: Props) {
  const [open, setOpen] = useState(false);
  const statusLabel = error ? "error" : done ? "done" : "running…";

  return (
    <div className="tool-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="tool-panel-header"
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="tool-panel-name">{name}</span>
          <span className="tool-panel-status">{statusLabel}</span>
        </span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="tool-panel-body">
          <pre className="tool-panel-pre">
            {JSON.stringify(args, null, 2)}
          </pre>
          {done && (
            <pre className="tool-panel-pre">
              {error ?? (typeof result === "string" ? result : JSON.stringify(result, null, 2))}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
