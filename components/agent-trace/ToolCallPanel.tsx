"use client";
import { useState } from "react";

type Props = { name: string; args: unknown; done: boolean; result?: unknown; error?: string };

export function ToolCallPanel({ name, args, done, result, error }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-2 border rounded-md text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span>
          <span className="font-mono">{name}</span>
          {" "}
          <span className="text-zinc-500">
            {error ? "error" : done ? "done" : "running…"}
          </span>
        </span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 p-2 rounded overflow-x-auto">
            {JSON.stringify(args, null, 2)}
          </pre>
          {done && (
            <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 p-2 rounded overflow-x-auto">
              {error ?? (typeof result === "string" ? result : JSON.stringify(result, null, 2))}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
