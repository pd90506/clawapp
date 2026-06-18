"use client";
import { SidebarHeader } from "@/components/sidebar/SidebarHeader";
import { SessionList } from "@/components/sidebar/SessionList";
import { useGatewayHealth } from "@/hooks/useGatewayHealth";
import { LinkIcon, ActivityIcon, ClockIcon, CogIcon } from "./Icons";

type Props = {
  activeSessionId: string | null;
  pinnedIds: Set<string>;
  onSelectSession: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCollapse: () => void;
  refreshNonce?: number;
};

export function LeftSidebar({
  activeSessionId, pinnedIds, onSelectSession, onTogglePin,
  onCollapse, refreshNonce,
}: Props) {
  const health = useGatewayHealth();

  // Derive status from health
  const status: "live" | "connecting" | "error" =
    health === null ? "connecting" :
    health.ok ? "live" :
    "error";

  const statusLabel =
    status === "live" ? "Connected" :
    status === "connecting" ? "Connecting…" :
    "Not connected";

  // Click-to-refresh health (re-mount via key trick is overkill; just navigate to /api/health)
  const handleSocketClick = () => {
    // Soft refresh: fire health endpoint manually (the hook auto-polls every 10s anyway)
    fetch("/api/health").catch(() => {/* non-fatal */});
  };

  return (
    <aside className="rail">
      <SidebarHeader onCollapse={onCollapse} />

      {/* Socket card */}
      <button className="socket-card" type="button" onClick={handleSocketClick}>
        <LinkIcon size={14} />
        <span className="url">{statusLabel}</span>
        <span className={`status-dot ${status}`} />
      </button>

      {/* Nav rows */}
      <div className="rail-list">
        <div className="rail-item">
          <span className="ic"><ActivityIcon size={15} /></span>
          Assistant activity
        </div>
        <div className="rail-item">
          <span className="ic"><ClockIcon size={15} /></span>
          Scheduled tasks
        </div>
      </div>

      {/* Sessions list */}
      <div className="convos">
        <SessionList
          activeSessionId={activeSessionId}
          pinnedIds={pinnedIds}
          onSelect={onSelectSession}
          onTogglePin={onTogglePin}
          refreshNonce={refreshNonce}
        />
      </div>

      {/* Footer — settings lives here (placeholder until the panel ships) */}
      <div className="rail-foot">
        <button
          className="icon-btn"
          type="button"
          aria-label="Settings"
          disabled
          title="Coming in v1.3"
          style={{ opacity: 0.4, cursor: "not-allowed" }}
        >
          <CogIcon size={16} />
        </button>
      </div>
    </aside>
  );
}
