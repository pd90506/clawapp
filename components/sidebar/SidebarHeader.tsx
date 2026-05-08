"use client";

type Props = {
  onNewChat: () => void;
  onCollapse: () => void;
  disabled: boolean;
};

export function SidebarHeader({ onNewChat, onCollapse, disabled }: Props) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-soft)]">
      <div className="font-medium text-sm">Chats</div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onNewChat}
          disabled={disabled}
          aria-label="New chat"
          className="w-7 h-7 rounded-lg hover:bg-[var(--bg-hover)] grid place-items-center disabled:opacity-50"
        >
          <span className="text-base">＋</span>
        </button>
        <button
          type="button"
          aria-label="Settings"
          disabled
          title="Coming in v1.3"
          className="w-7 h-7 rounded-lg grid place-items-center opacity-50 cursor-not-allowed"
        >
          <span className="text-sm">⚙</span>
        </button>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          className="w-7 h-7 rounded-lg hover:bg-[var(--bg-hover)] grid place-items-center"
        >
          <span className="text-sm">‹</span>
        </button>
      </div>
    </div>
  );
}
