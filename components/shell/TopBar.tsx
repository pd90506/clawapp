"use client";
import type { Tab } from "@/hooks/useActiveTab";

type Props = {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
};

export function TopBar({ tab, onTabChange, leftOpen, rightOpen, onToggleLeft, onToggleRight }: Props) {
  return (
    <div className="h-14 shrink-0 flex items-center px-3 border-b border-[var(--border-soft)] bg-[var(--bg-base)]">
      <button
        type="button"
        aria-label="Toggle left sidebar"
        onClick={onToggleLeft}
        className="w-9 h-9 rounded-lg hover:bg-[var(--bg-hover)] grid place-items-center"
      >
        <span className="text-base">{leftOpen ? "‹" : "›"}</span>
      </button>
      <div className="flex-1 flex justify-center">
        <div className="inline-flex bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-full p-0.5 text-sm">
          <TabButton current={tab} value="chat" label="Chat" onSelect={onTabChange} />
          <TabButton current={tab} value="channels" label="Channels" onSelect={onTabChange} />
        </div>
      </div>
      <button
        type="button"
        aria-label="Toggle right sidebar"
        onClick={onToggleRight}
        className="w-9 h-9 rounded-lg hover:bg-[var(--bg-hover)] grid place-items-center"
      >
        <span className="text-base">{rightOpen ? "›" : "‹"}</span>
      </button>
    </div>
  );
}

function TabButton({ current, value, label, onSelect }: { current: Tab; value: Tab; label: string; onSelect: (t: Tab) => void }) {
  const active = current === value;
  return (
    <button
      type="button"
      aria-selected={active}
      onClick={() => onSelect(value)}
      className={`px-4 py-1 rounded-full transition-colors ${
        active ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)]"
      }`}
    >
      {label}
    </button>
  );
}
