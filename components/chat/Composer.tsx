"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SlashIcon, PlusIcon, BulbIcon, StopIcon } from "@/components/shell/Icons";

type Effort = "low" | "medium" | "high" | "max";

type Props = { onSend: (text: string) => void; disabled: boolean; streaming?: boolean; onStop?: () => void };

const SLASH_COMMANDS = [
  { cmd: "plan",    desc: "Break task into steps" },
  { cmd: "explain", desc: "Explain selected code" },
  { cmd: "rewrite", desc: "Rewrite for clarity" },
  { cmd: "web",     desc: "Search the web" },
  { cmd: "reset",   desc: "Start a new session" },
];

const ATTACH_ITEMS = [
  { key: "image", icon: "🖼", label: "Image",  hint: "png, jpg, gif, webp" },
  { key: "file",  icon: "📄", label: "Files",  hint: "pdf, txt, md, …" },
];

const EFFORTS: { key: Effort; label: string; hint: string }[] = [
  { key: "low",    label: "Low",    hint: "Faster, less depth" },
  { key: "medium", label: "Medium", hint: "Balanced" },
  { key: "high",   label: "High",   hint: "More reasoning" },
  { key: "max",    label: "Max",    hint: "Full depth" },
];

export function Composer({ onSend, disabled, streaming = false, onStop }: Props) {
  const [text, setText] = useState("");
  const [model, setModel] = useState("claw-coder");
  const [effort, setEffort] = useState<Effort>("medium");
  const [openMenu, setOpenMenu] = useState<"slash" | "plus" | "effort" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [text]);

  // Click-outside to close popmenus
  useEffect(() => {
    if (!openMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".menu-anchor")) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openMenu]);

  const ready = text.trim().length > 0 && !disabled;

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    if (e.shiftKey || e.altKey) return;
    e.preventDefault();
    submit();
  };

  const insertSlash = (cmd: string) => {
    setText((v) => (v.endsWith(" ") || v === "" ? v : v + " ") + "/" + cmd + " ");
    setOpenMenu(null);
    textareaRef.current?.focus();
  };

  const currentEffortLabel = EFFORTS.find((e) => e.key === effort)?.label ?? "Medium";

  return (
    <div className="composer">
      <div className="composer-inner">
        <textarea
          ref={textareaRef}
          rows={1}
          aria-label="Message input"
          placeholder={disabled ? "Gateway unavailable" : "Message OpenClaw…  (Return to send, Shift+Return for newline)"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
        />
        <div className="composer-bar">
          {/* Slash commands */}
          <div className="menu-anchor">
            <button
              type="button"
              className={`cbtn icon-only ghost${openMenu === "slash" ? " active" : ""}`}
              title="Slash command"
              onClick={() => setOpenMenu(openMenu === "slash" ? null : "slash")}
            >
              <SlashIcon size={13} />
            </button>
            {openMenu === "slash" && (
              <div className="popmenu" role="menu">
                <div className="popmenu-head">Commands</div>
                {SLASH_COMMANDS.map((c) => (
                  <button
                    key={c.cmd}
                    type="button"
                    className="popmenu-item"
                    role="menuitem"
                    onClick={() => insertSlash(c.cmd)}
                  >
                    <span className="cmd">/{c.cmd}</span>
                    <span className="desc">{c.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Attach */}
          <div className="menu-anchor">
            <button
              type="button"
              className={`cbtn icon-only ghost${openMenu === "plus" ? " active" : ""}`}
              title="Attach"
              onClick={() => setOpenMenu(openMenu === "plus" ? null : "plus")}
            >
              <PlusIcon size={14} />
            </button>
            {openMenu === "plus" && (
              <div className="popmenu" role="menu">
                {ATTACH_ITEMS.map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    className="popmenu-item"
                    role="menuitem"
                    onClick={() => setOpenMenu(null)}
                  >
                    <span className="ic">{it.icon}</span>
                    <span className="cmd">{it.label}</span>
                    <span className="desc">{it.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="spacer" />

          {/* Thinking effort */}
          <div className="menu-anchor">
            <button
              type="button"
              className={`cbtn ghost effort-btn${openMenu === "effort" ? " active" : ""}`}
              title="Thinking effort"
              onClick={() => setOpenMenu(openMenu === "effort" ? null : "effort")}
            >
              <BulbIcon size={13} />
              <span className="effort-label">{currentEffortLabel}</span>
            </button>
            {openMenu === "effort" && (
              <div className="popmenu align-right" role="menu">
                <div className="popmenu-head">Thinking effort</div>
                {EFFORTS.map((e) => (
                  <button
                    key={e.key}
                    type="button"
                    className={`popmenu-item${e.key === effort ? " on" : ""}`}
                    role="menuitem"
                    onClick={() => { setEffort(e.key); setOpenMenu(null); }}
                  >
                    <span className="effort-bars" data-level={e.key}>
                      <i /><i /><i /><i />
                    </span>
                    <span className="cmd">{e.label}</span>
                    <span className="desc">{e.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <select
            className="cbtn"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{ appearance: "none", paddingRight: 22 }}
          >
            <option value="claw-coder">Claw Coder</option>
            <option value="claw-base">Claw Base</option>
            <option value="claw-fast">Claw Fast</option>
          </select>

          {streaming ? (
            <button type="button" className="send-btn streaming" onClick={onStop} aria-label="Stop streaming">
              <StopIcon size={11} /> Stop
            </button>
          ) : (
            <button
              type="button"
              className={`send-btn${ready ? " ready" : ""}`}
              onClick={() => ready && submit()}
              disabled={!ready}
              aria-label="Send message"
            >
              <span className="kbd">↵</span> Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
