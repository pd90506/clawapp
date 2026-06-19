"use client";
import { ChevLIcon } from "@/components/shell/Icons";

type Props = {
  onCollapse: () => void;
};

// Agents can't be added or removed from the app, so the header carries no
// new-chat (+) or settings affordance — just the title and a collapse control.
// Settings lives in the sidebar footer.
export function SidebarHeader({ onCollapse }: Props) {
  return (
    <div className="rail-head">
      <div className="title">Chats</div>
      <button
        type="button"
        onClick={onCollapse}
        aria-label="Collapse sidebar"
        className="icon-btn"
      >
        <ChevLIcon size={14} />
      </button>
    </div>
  );
}
