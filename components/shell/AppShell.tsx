"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { TopBar } from "./TopBar";
import { LeftSidebar } from "./LeftSidebar";
import { RightDrawer } from "./RightDrawer";
import { ChatView } from "./ChatView";
import { ChannelsComingSoon } from "./ChannelsComingSoon";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useActiveTab } from "@/hooks/useActiveTab";
import { usePinnedSessions } from "@/hooks/usePinnedSessions";
import { useGatewayHealth } from "@/hooks/useGatewayHealth";
import { useLayoutWidths } from "@/hooks/useLayoutWidths";

export function AppShell() {
  const sidebars = useSidebarState();
  const { tab, setTab } = useActiveTab();
  const { isPinned: _isPinned, togglePin, pinnedIds } = usePinnedSessions();
  void _isPinned;
  const health = useGatewayHealth();
  const gatewayDown = health !== null && !health.ok;

  const { leftWidth, rightWidth, setLeftWidth, setRightWidth } = useLayoutWidths();

  // In the Electron shell the native traffic lights overlay the top-left of the
  // window; tag the root so CSS can reserve space for them and mark the title bar
  // as a draggable region. No-op in the browser build.
  useEffect(() => {
    const w = window as unknown as { clawapp?: { isElectron?: boolean; platform?: string } };
    if (!w.clawapp?.isElectron) return;
    const root = document.documentElement;
    root.classList.add("electron");
    if (w.clawapp.platform === "darwin") root.classList.add("mac");
  }, []);

  // Responsive window width
  const [winW, setWinW] = useState(typeof window !== "undefined" ? window.innerWidth : 1500);
  useEffect(() => {
    const onResize = () => setWinW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Below 480px: phone-drawer mode — panes overlay full-width, don't push chat.
  // Below 720px: panes are mutually exclusive (one at a time) but still inline.
  // Above 720px: both panes can co-exist inline.
  const drawer = winW < 480;
  const exclusive = winW < 720;

  const effLeft = sidebars.left && (!exclusive || !sidebars.right);
  const effRight = sidebars.right && (!exclusive || !sidebars.left);
  const inlineLeft = effLeft && !drawer;
  const inlineRight = effRight && !drawer;

  const onToggleLeft = useCallback(() => {
    sidebars.setLeft(!sidebars.left);
    if (!sidebars.left && exclusive) sidebars.setRight(false);
  }, [sidebars, exclusive]);

  const onToggleRight = useCallback(() => {
    sidebars.setRight(!sidebars.right);
    if (!sidebars.right && exclusive) sidebars.setLeft(false);
  }, [sidebars, exclusive]);

  // Drag resize
  const dragRef = useRef<{ which: "left" | "right"; startX: number; startLeft: number; startRight: number } | null>(null);
  // Keep a stable ref to current widths so the event handler closure stays fresh
  const widthsRef = useRef({ leftWidth, rightWidth });
  useEffect(() => {
    widthsRef.current = { leftWidth, rightWidth };
  }, [leftWidth, rightWidth]);

  const startDragLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const { leftWidth: lw, rightWidth: rw } = widthsRef.current;
    dragRef.current = { which: "left", startX: e.clientX, startLeft: lw, startRight: rw };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const startDragRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const { leftWidth: lw, rightWidth: rw } = widthsRef.current;
    dragRef.current = { which: "right", startX: e.clientX, startLeft: lw, startRight: rw };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { which, startX, startLeft, startRight } = dragRef.current;
      const dx = e.clientX - startX;
      if (which === "left") {
        setLeftWidth(Math.max(200, Math.min(440, startLeft + dx)));
      } else {
        setRightWidth(Math.max(220, Math.min(480, startRight - dx)));
      }
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setLeftWidth, setRightWidth]);

  // Active session
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("session");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) setActiveSessionId(id);
  }, []);
  const [selectedAgent, setSelectedAgent] = useState<string>("main");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const setActive = useCallback((id: string | null) => {
    setActiveSessionId(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("session", id);
      else url.searchParams.delete("session");
      window.history.replaceState(null, "", url);
    }
  }, []);

  const gridCols = [
    inlineLeft ? `${leftWidth}px` : "0px",
    inlineLeft ? "1px" : "0px",
    "1fr",
    inlineRight ? "1px" : "0px",
    inlineRight ? `${rightWidth}px` : "0px",
  ].join(" ");

  return (
    <div className="viewport">
      <div className="window">
        <TopBar
          tab={tab}
          onTabChange={setTab}
          leftOpen={effLeft}
          rightOpen={effRight}
          onToggleLeft={onToggleLeft}
          onToggleRight={onToggleRight}
        />

        <div className="body" style={{ gridTemplateColumns: gridCols }}>
          {/* Left pane slot */}
          <div
            className="pane-slot"
            style={{ opacity: inlineLeft ? 1 : 0, pointerEvents: inlineLeft ? "auto" : "none" }}
          >
            <LeftSidebar
              activeSessionId={activeSessionId}
              pinnedIds={pinnedIds}
              onSelectSession={setActive}
              onTogglePin={togglePin}
              onCollapse={onToggleLeft}
              refreshNonce={refreshNonce}
            />
          </div>

          {/* Left divider */}
          <div
            className="divider"
            onMouseDown={inlineLeft ? startDragLeft : undefined}
            style={{ pointerEvents: inlineLeft ? "auto" : "none", opacity: inlineLeft ? 1 : 0 }}
            title="Drag to resize"
          />

          {/* Chat / Channels main area */}
          <div className="thread-wrap">
            {tab === "chat" ? (
              <ChatView
                sessionId={activeSessionId}
                selectedAgent={selectedAgent}
                onSelectAgent={setSelectedAgent}
                composerDisabled={gatewayDown}
                onTurnComplete={() => setRefreshNonce((n) => n + 1)}
              />
            ) : (
              <ChannelsComingSoon />
            )}
          </div>

          {/* Right divider */}
          <div
            className="divider"
            onMouseDown={inlineRight ? startDragRight : undefined}
            style={{ pointerEvents: inlineRight ? "auto" : "none", opacity: inlineRight ? 1 : 0 }}
            title="Drag to resize"
          />

          {/* Right pane slot */}
          <div
            className="pane-slot"
            style={{ opacity: inlineRight ? 1 : 0, pointerEvents: inlineRight ? "auto" : "none" }}
          >
            <RightDrawer onCollapse={onToggleRight} />
          </div>
        </div>

        {/* Phone-drawer overlays */}
        {drawer && effLeft && (
          <div className="overlay-pane left" style={{ left: 0, right: 0, width: "auto" }}>
            <LeftSidebar
              activeSessionId={activeSessionId}
              pinnedIds={pinnedIds}
              onSelectSession={(id) => { setActive(id); sidebars.setLeft(false); }}
              onTogglePin={togglePin}
              onCollapse={() => sidebars.setLeft(false)}
              refreshNonce={refreshNonce}
            />
          </div>
        )}
        {drawer && effRight && (
          <div className="overlay-pane right" style={{ left: 0, right: 0, width: "auto" }}>
            <RightDrawer onCollapse={() => sidebars.setRight(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
