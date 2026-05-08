"use client";

type Props = {
  side: "left" | "right";
  onClick: () => void;
};

export function SidebarToggleOverlay({ side, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Open sidebar" : "Open desk"}
      className={`fixed top-3 ${side === "left" ? "left-3" : "right-3"} z-20 w-9 h-9 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-soft)] shadow-sm grid place-items-center hover:bg-[var(--bg-hover)]`}
    >
      <span className="text-base">{side === "left" ? "›" : "‹"}</span>
    </button>
  );
}
