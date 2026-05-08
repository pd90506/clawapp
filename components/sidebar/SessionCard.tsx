"use client";
import { agentVisual } from "@/lib/agentVisuals";
import { formatRelativeTime } from "@/hooks/useRelativeTime";

export type SessionView = {
  id: string;
  title: string;
  agentId: string;
  model?: string;
  at: number;
};

type Props = {
  session: SessionView;
  active: boolean;
  pinned: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
};

export function SessionCard({ session, active, pinned, onSelect, onTogglePin }: Props) {
  const v = agentVisual(session.agentId);
  return (
    <div
      onContextMenu={(e) => { e.preventDefault(); onTogglePin(session.id); }}
      onClick={() => onSelect(session.id)}
      className={`flex items-start gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
        active ? "bg-[var(--bg-active)]" : "hover:bg-[var(--bg-hover)]"
      }`}
    >
      <span
        aria-hidden
        className="shrink-0 w-8 h-8 rounded-full grid place-items-center text-xs text-white font-medium"
        style={{ background: v.color }}
      >
        {v.initial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {active && <span aria-label="active session" className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
          <span className="truncate text-sm text-[var(--text-primary)]">{session.title}</span>
          {pinned && <span aria-label="pinned" className="text-xs text-[var(--text-faint)]">📌</span>}
        </div>
        <div className="text-xs text-[var(--text-muted)] truncate">
          {session.agentId}{session.model ? ` · ${session.model}` : ""} · {formatRelativeTime(session.at)}
        </div>
      </div>
    </div>
  );
}
