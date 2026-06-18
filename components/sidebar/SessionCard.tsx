"use client";
import { useEffect, useRef, useState } from "react";

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
  unread?: boolean;
  pinned: boolean;
  avatarUrl?: string;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRename?: (agentId: string, name: string) => void;
  onSetAvatar?: (agentId: string, file: File) => void;
  onClearAvatar?: (agentId: string) => void;
};

export function SessionCard({ session, active, unread, pinned, avatarUrl, onSelect, onTogglePin, onRename, onSetAvatar, onClearAvatar }: Props) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(session.title);
  // Exiting edit mode unmounts the input, which fires onBlur — guard so Enter/Esc
  // (which already finished the edit) don't trigger a second commit.
  const doneRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Avatar initial from the display name (so a nickname's first letter shows).
  const initial = session.title?.[0]?.toUpperCase() ?? "?";

  const startEdit = () => {
    if (!onRename) return;
    doneRef.current = false;
    setDraft(session.title);
    setEditing(true);
  };
  const commit = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setEditing(false);
    const v = draft.trim();
    if (v !== session.title) onRename?.(session.agentId, v); // empty clears the override
  };
  const cancel = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setEditing(false);
    setDraft(session.title);
  };

  // Close the row menu on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
      onClick={() => { if (!editing && !menuOpen) onSelect(session.id); }}
      className={`convo${active ? " active" : ""}`}
    >
      <div className="av">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local data-URL avatar; next/image optimization doesn't apply
          <img src={avatarUrl} alt="" />
        ) : initial}
      </div>

      {/* Hidden picker for "Set avatar…" */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // allow re-picking the same file
          if (f) onSetAvatar?.(session.agentId, f);
        }}
      />
      {editing ? (
        <input
          className="convo-title-edit"
          aria-label="Rename agent"
          value={draft}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape") { e.preventDefault(); cancel(); }
          }}
        />
      ) : (
        <div className="convo-title">{session.title}</div>
      )}
      {/* Subtitle = the real agent name (id); title above is the nickname. */}
      <div className="convo-meta">{session.agentId}</div>

      {unread && (
        <span
          aria-label="unread messages"
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

      {/* Hover kebab → row menu */}
      <button
        type="button"
        aria-label="Agent options"
        title="Options"
        className="convo-kebab"
        onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
      >
        ⋮
      </button>

      {menuOpen && (
        <>
          {/* Backdrop to dismiss on outside click */}
          <div
            className="menu-backdrop"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); }}
          />
          <div className="convo-menu" role="menu" onClick={(e) => e.stopPropagation()}>
            {onRename && (
              <button type="button" role="menuitem" className="convo-menu-item" onClick={() => { setMenuOpen(false); startEdit(); }}>
                Rename
              </button>
            )}
            {onSetAvatar && (
              <button type="button" role="menuitem" className="convo-menu-item" onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}>
                Set avatar…
              </button>
            )}
            {avatarUrl && onClearAvatar && (
              <button type="button" role="menuitem" className="convo-menu-item" onClick={() => { setMenuOpen(false); onClearAvatar(session.agentId); }}>
                Remove avatar
              </button>
            )}
            <button type="button" role="menuitem" className="convo-menu-item" onClick={() => { setMenuOpen(false); onTogglePin(session.id); }}>
              {pinned ? "Unpin" : "Pin"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
