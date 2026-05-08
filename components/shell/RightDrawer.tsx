"use client";
import { useState } from "react";
import { BoltIcon, SearchIcon, FolderIcon, FilterIcon, SortIcon } from "./Icons";

type Props = { onCollapse: () => void };

export function RightDrawer({ onCollapse }: Props) {
  const [tab, setTab] = useState<"files" | "ws">("files");

  return (
    <aside className="rpanel">
      <div className="rpanel-head">
        <div className="title">OpenClaw</div>
        <button type="button" className="skill-chip" onClick={onCollapse} aria-label="Collapse desk">
          <BoltIcon size={12} /> Project skills
        </button>
      </div>

      <div className="rp-tabs">
        <button
          type="button"
          className={tab === "files" ? "on" : ""}
          onClick={() => setTab("files")}
        >
          Output Files
        </button>
        <button
          type="button"
          className={tab === "ws" ? "on" : ""}
          onClick={() => setTab("ws")}
        >
          Workspace
        </button>
      </div>

      <div className="rp-search">
        <SearchIcon size={13} />
        <input placeholder="Search workspace" />
      </div>

      <div className="rp-filters">
        <span className="f"><FolderIcon size={11} /></span>
        <span className="f"><FilterIcon size={11} /> Filter</span>
        <span className="f" style={{ marginLeft: "auto" }}><SortIcon size={11} /> Recent</span>
      </div>

      <div className="rp-content">
        <div className="rp-empty">No files yet</div>
      </div>
    </aside>
  );
}
