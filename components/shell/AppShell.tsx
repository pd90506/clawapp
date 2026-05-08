"use client";
import { useCallback, useEffect, useState } from "react";
import { TopBar } from "./TopBar";
import { LeftSidebar } from "./LeftSidebar";
import { RightDrawer } from "./RightDrawer";
import { SidebarToggleOverlay } from "./SidebarToggleOverlay";
import { ChatView } from "./ChatView";
import { ChannelsComingSoon } from "./ChannelsComingSoon";
import { StatusBanner } from "@/components/connection/StatusBanner";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useActiveTab } from "@/hooks/useActiveTab";
import { usePinnedSessions } from "@/hooks/usePinnedSessions";
import { useGatewayHealth } from "@/hooks/useGatewayHealth";

export function AppShell() {
  const sidebars = useSidebarState();
  const { tab, setTab } = useActiveTab();
  const { isPinned: _isPinned, togglePin, pinnedIds } = usePinnedSessions();
  void _isPinned;
  const health = useGatewayHealth();
  const gatewayDown = health !== null && !health.ok;

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>("main");
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Read ?session=<key> from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setActiveSessionId(sp.get("session"));
  }, []);

  const setActive = useCallback((id: string | null) => {
    setActiveSessionId(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("session", id);
      else url.searchParams.delete("session");
      window.history.replaceState(null, "", url);
    }
  }, []);

  const onNewChat = useCallback(async () => {
    if (gatewayDown) return;
    try {
      const r = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      if (!r.ok) return;
      const j = await r.json();
      setActive(j.id);
      setRefreshNonce((n) => n + 1);
    } catch { /* non-fatal */ }
  }, [gatewayDown, setActive]);

  return (
    <div className="h-full flex flex-col">
      <StatusBanner />
      <TopBar
        tab={tab}
        onTabChange={setTab}
        leftOpen={sidebars.left}
        rightOpen={sidebars.right}
        onToggleLeft={sidebars.toggleLeft}
        onToggleRight={sidebars.toggleRight}
      />
      <div className="flex-1 flex overflow-hidden">
        {sidebars.left ? (
          <LeftSidebar
            key={refreshNonce}
            activeSessionId={activeSessionId}
            pinnedIds={pinnedIds}
            onSelectSession={setActive}
            onTogglePin={togglePin}
            onNewChat={onNewChat}
            onCollapse={sidebars.toggleLeft}
            newChatDisabled={gatewayDown}
          />
        ) : (
          <SidebarToggleOverlay side="left" onClick={sidebars.toggleLeft} />
        )}
        <main className="flex-1 flex flex-col min-w-0">
          {tab === "chat" ? (
            <ChatView
              sessionId={activeSessionId}
              selectedAgent={selectedAgent}
              onSelectAgent={setSelectedAgent}
              composerDisabled={gatewayDown}
            />
          ) : (
            <ChannelsComingSoon />
          )}
        </main>
        {sidebars.right ? (
          <RightDrawer onCollapse={sidebars.toggleRight} />
        ) : (
          <SidebarToggleOverlay side="right" onClick={sidebars.toggleRight} />
        )}
      </div>
    </div>
  );
}
