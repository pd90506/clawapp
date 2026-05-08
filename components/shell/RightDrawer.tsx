"use client";

type Props = { onCollapse: () => void };

export function RightDrawer({ onCollapse }: Props) {
  return (
    <aside className="w-[320px] shrink-0 bg-[var(--bg-card)] border-l border-[var(--border-soft)] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-soft)]">
        <div className="font-medium text-sm">Desk</div>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse desk"
          className="w-7 h-7 rounded-lg hover:bg-[var(--bg-hover)] grid place-items-center"
        >
          <span className="text-sm">›</span>
        </button>
      </div>
      <div className="flex-1 px-3 py-6 text-center text-sm text-[var(--text-faint)]">
        No files yet. Coming in v1.3.
      </div>
      <div className="border-t border-[var(--border-soft)] px-3 py-2 font-medium text-sm">Note</div>
      <div className="px-3 py-6 text-sm text-[var(--text-faint)]">
        Notes about your desk land here. v1.3.
      </div>
    </aside>
  );
}
