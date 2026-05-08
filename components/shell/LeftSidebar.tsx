"use client";
import { SidebarHeader } from "@/components/sidebar/SidebarHeader";
import { SidebarNavRows } from "@/components/sidebar/SidebarNavRows";
import { SessionList } from "@/components/sidebar/SessionList";

type Props = {
  activeSessionId: string | null;
  pinnedIds: Set<string>;
  onSelectSession: (id: string) => void;
  onTogglePin: (id: string) => void;
  onNewChat: () => void;
  onCollapse: () => void;
  newChatDisabled: boolean;
};

export function LeftSidebar({
  activeSessionId, pinnedIds, onSelectSession, onTogglePin, onNewChat, onCollapse, newChatDisabled,
}: Props) {
  return (
    <aside className="w-[280px] shrink-0 bg-[var(--bg-card)] border-r border-[var(--border-soft)] flex flex-col">
      <SidebarHeader onNewChat={onNewChat} onCollapse={onCollapse} disabled={newChatDisabled} />
      <SidebarNavRows />
      <div className="flex-1 overflow-y-auto py-2">
        <SessionList
          activeSessionId={activeSessionId}
          pinnedIds={pinnedIds}
          onSelect={onSelectSession}
          onTogglePin={onTogglePin}
        />
      </div>
    </aside>
  );
}
