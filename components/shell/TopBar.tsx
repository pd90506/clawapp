"use client";
import type { Tab } from "@/hooks/useActiveTab";
import { SidebarIcon, RPanelIcon } from "./Icons";

type Props = {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
};

// leftOpen/rightOpen not used in the visual — toggle buttons are present regardless.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TopBar({ tab, onTabChange, leftOpen: _l, rightOpen: _r, onToggleLeft, onToggleRight }: Props) {
  return (
    <div className="titlebar">
      <div className="tb-left">
        <div className="traffic">
          <span className="dot r" />
          <span className="dot y" />
          <span className="dot g" />
        </div>
        <button
          type="button"
          aria-label="Toggle left sidebar"
          onClick={onToggleLeft}
          className="icon-btn"
        >
          <SidebarIcon size={16} />
        </button>
      </div>

      <div className="seg" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "chat"}
          className={tab === "chat" ? "on" : ""}
          onClick={() => onTabChange("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "channels"}
          className={tab === "channels" ? "on" : ""}
          onClick={() => onTabChange("channels")}
        >
          Channels
        </button>
      </div>

      <div className="tb-right">
        <button
          type="button"
          aria-label="Toggle right panel"
          onClick={onToggleRight}
          className="icon-btn"
        >
          <RPanelIcon size={16} />
        </button>
      </div>
    </div>
  );
}
