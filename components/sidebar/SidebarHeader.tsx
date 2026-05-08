"use client";
import { PlusIcon, CogIcon, ChevLIcon } from "@/components/shell/Icons";

type Props = {
  onNewChat: () => void;
  onCollapse: () => void;
  disabled: boolean;
};

export function SidebarHeader({ onNewChat, onCollapse, disabled }: Props) {
  return (
    <div className="rail-head">
      <div className="title">Chats</div>
      <button
        type="button"
        onClick={onNewChat}
        disabled={disabled}
        aria-label="New chat"
        className="icon-btn"
        style={{ opacity: disabled ? 0.5 : 1 }}
      >
        <PlusIcon size={16} />
      </button>
      <button
        type="button"
        aria-label="Settings"
        disabled
        title="Coming in v1.3"
        className="icon-btn"
        style={{ opacity: 0.4, cursor: "not-allowed" }}
      >
        <CogIcon size={15} />
      </button>
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
