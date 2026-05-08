"use client";
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
  onDelete: (id: string) => void;
};

export function SessionCard({ session, active, pinned: _pinned, onSelect, onTogglePin: _onTogglePin, onDelete }: Props) {
  // Use first letter of agentId as avatar initial
  const initial = session.agentId?.[0]?.toUpperCase() ?? "M";

  return (
    <div
      onContextMenu={(e) => { e.preventDefault(); _onTogglePin(session.id); }}
      onClick={() => onSelect(session.id)}
      className={`convo${active ? " active" : ""}`}
    >
      <div className="av">{initial}</div>
      <div className="convo-title">{session.title}</div>
      <div className="convo-meta">
        {session.agentId}{session.model ? ` · ${session.model}` : ""} · {formatRelativeTime(session.at)}
      </div>
      {active && (
        <span
          aria-label="active session"
          style={{
            position: "absolute",
            left: 4,
            top: "50%",
            transform: "translateY(-50%)",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--accent)",
            display: "block",
          }}
        />
      )}
      <button
        type="button"
        aria-label="Delete chat"
        title="Delete chat"
        onClick={(e) => {
          e.stopPropagation();
          if (typeof window !== "undefined" && !window.confirm(`Delete "${session.title}"? This cannot be undone.`)) return;
          onDelete(session.id);
        }}
        className="convo-delete"
      >
        ×
      </button>
    </div>
  );
}
