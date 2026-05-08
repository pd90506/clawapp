"use client";
import { useState } from "react";

type Props = {
  name: string;
  args: unknown;
  done: boolean;
  result?: unknown;
  error?: string;
  actor?: string;
};

function pickIcon(name: string): string {
  if (/search|web/i.test(name)) return "🌐";
  if (/fetch|read/i.test(name)) return "📄";
  if (/edit|write|patch/i.test(name)) return "✏️";
  if (/exec|shell|bash/i.test(name)) return "⚙️";
  return "🔧";
}

function argsToChips(args: unknown): string[] {
  if (!args) return [];
  if (typeof args === "string") return [args];
  if (Array.isArray(args)) return args.map((a) => typeof a === "string" ? a : JSON.stringify(a));
  if (typeof args === "object") {
    return Object.values(args as Record<string, unknown>).slice(0, 4).map((v) =>
      typeof v === "string" ? v : JSON.stringify(v),
    );
  }
  return [String(args)];
}

export function ToolCallPanel({ name, args, done, result, error, actor = "OpenClaw" }: Props) {
  const [open, setOpen] = useState(false);
  const status: "ok" | "err" | "run" = !done ? "run" : error ? "err" : "ok";
  const chips = argsToChips(args);
  const hasDetail = chips.length > 0 || result !== undefined || !!error;
  const verb = `called ${name}`;

  const detail: { k: string; v: string }[] = [];
  if (args !== undefined) {
    detail.push({ k: "args", v: typeof args === "string" ? args : JSON.stringify(args, null, 2) });
  }
  if (done && result !== undefined) {
    detail.push({ k: "result", v: typeof result === "string" ? result : JSON.stringify(result, null, 2) });
  }
  if (error) detail.push({ k: "error", v: error });

  return (
    <div className={`annot tool-wrap ${open ? "open" : ""}`}>
      <div
        className={`annot tool ${status} ${hasDetail ? "expandable" : ""}`}
        onClick={hasDetail ? () => setOpen((v) => !v) : undefined}
        role={hasDetail ? "button" : undefined}
      >
        {hasDetail && <span className="tool-caret">{open ? "⌄" : "›"}</span>}
        <span className="tool-icon">{pickIcon(name)}</span>
        <span className="tool-actor">{actor}</span>
        <span className="tool-verb">{verb}</span>
        {chips.length > 0 && (
          <span className="tool-args">
            {chips.map((arg, i) => <span key={i} className="tool-arg">{arg}</span>)}
          </span>
        )}
        <span className={`tool-status ${status}`}>
          {status === "ok" ? "✓" : status === "err" ? "✕" : "…"}
        </span>
      </div>
      {open && hasDetail && (
        <div className="tool-detail">
          {detail.map((d, i) => (
            <div key={i} className="tool-detail-row">
              <span className="k">{d.k}</span>
              <span className="v">{d.v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
