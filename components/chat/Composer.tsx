"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SlashIcon, PlusIcon, BulbIcon, StopIcon } from "@/components/shell/Icons";

type Effort = "low" | "medium" | "high" | "max";

type ModelItem = { id: string; label: string; provider?: string; isDefault: boolean };

// The display name for a model row. A label that's just the provider/brand
// (e.g. the config alias "DeepSeek" on a `deepseek` model) isn't a model name —
// fall back to the concrete model id so the picker reads "deepseek-v4-flash",
// not "DeepSeek". Genuine aliases like "opus" (provider "anthropic") are kept.
export function modelDisplayName(m: { id: string; label?: string; provider?: string }): string {
  const label = m.label?.trim();
  if (!label) return m.id;
  if (m.provider && label.toLowerCase() === m.provider.trim().toLowerCase()) return m.id;
  return label;
}

type Props = { onSend: (text: string) => void; disabled: boolean; streaming?: boolean; onStop?: () => void; agentId?: string };

// A slash command (or skill — the gateway surfaces skills as commands too),
// fetched live from /api/commands.
type SlashCommand = { name: string; description?: string; source?: string };

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

const FALLBACK_MODELS: ModelItem[] = [
  { id: "default", label: "Default", isDefault: true },
];

const LS_KEY = "clawapp.model";

function loadStoredModel(): string | null {
  try { return localStorage.getItem(LS_KEY); } catch { return null; }
}
function saveStoredModel(id: string) {
  try { localStorage.setItem(LS_KEY, id); } catch { /* ignore */ }
}

export function Composer({ onSend, disabled, streaming = false, onStop, agentId }: Props) {
  const [text, setText] = useState("");
  const [effort, setEffort] = useState<Effort>("medium");
  const [openMenu, setOpenMenu] = useState<"slash" | "plus" | "effort" | "model" | null>(null);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [model, setModelState] = useState<string>("");
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [cmdIndex, setCmdIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch real models from openclaw on mount
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: { models?: ModelItem[] }) => {
        const list = data.models && data.models.length > 0 ? data.models : FALLBACK_MODELS;
        setModels(list);
        // Restore from localStorage or pick the default
        const stored = loadStoredModel();
        const match = stored ? list.find((m) => m.id === stored) : null;
        const defaultItem = list.find((m) => m.isDefault) ?? list[0];
        setModelState(match ? match.id : defaultItem.id);
      })
      .catch(() => {
        setModels(FALLBACK_MODELS);
        setModelState(FALLBACK_MODELS[0].id);
      });
  }, []);

  const setModel = (id: string) => {
    setModelState(id);
    saveStoredModel(id);
  };

  // Fetch the agent's available slash commands + skills for the "/" autocomplete.
  useEffect(() => {
    const url = agentId ? `/api/commands?agent=${encodeURIComponent(agentId)}` : "/api/commands";
    fetch(url)
      .then((r) => r.json())
      .then((d: { commands?: SlashCommand[] }) => setCommands(d.commands ?? []))
      .catch(() => setCommands([]));
  }, [agentId]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [text]);

  // Reveal the scrollbar only while actively scrolling, then fade it back out.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      el.classList.add("scrolling");
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove("scrolling"), 700);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); clearTimeout(timer); };
  }, []);

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

  // "/" autocomplete: active while the composer holds just a slash token (a
  // leading "/" with no space yet). Filter by the partial name typed so far.
  const slashQuery = /^\/(\S*)$/.exec(text)?.[1];
  const filteredCommands = slashQuery === undefined ? []
    : commands.filter((c) => c.name.toLowerCase().startsWith(slashQuery.toLowerCase())).slice(0, 50);
  const showSlash = filteredCommands.length > 0;
  // Keep the highlight in range as the query narrows the list.
  useEffect(() => { setCmdIndex(0); }, [slashQuery]);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };

  const insertSlash = (name: string) => {
    setText(`/${name} `);
    setOpenMenu(null);
    textareaRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // While the "/" autocomplete is open, arrows move the highlight and
    // Enter/Tab accept it (instead of sending); Escape dismisses.
    if (showSlash) {
      if (e.key === "ArrowDown") { e.preventDefault(); setCmdIndex((i) => (i + 1) % filteredCommands.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setCmdIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertSlash((filteredCommands[cmdIndex] ?? filteredCommands[0]).name);
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); setText(""); return; }
    }
    if (e.key !== "Enter") return;
    if (e.shiftKey || e.altKey) return;
    e.preventDefault();
    submit();
  };

  const currentEffortLabel = EFFORTS.find((e) => e.key === effort)?.label ?? "Medium";
  const currentModel = models.find((m) => m.id === model);

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
          {/* Slash commands / skills — autocomplete opens as you type "/". */}
          <div className="menu-anchor">
            <button
              type="button"
              className={`cbtn icon-only ghost${showSlash ? " active" : ""}`}
              title="Slash command"
              onClick={() => { setText((t) => (t.startsWith("/") ? t : "/")); textareaRef.current?.focus(); }}
            >
              <SlashIcon size={13} />
            </button>
            {showSlash && (
              <div className="popmenu cmd-menu" role="menu">
                <div className="popmenu-head">Commands &amp; skills</div>
                {filteredCommands.map((c, i) => (
                  <button
                    key={c.name}
                    type="button"
                    className={`popmenu-item${i === cmdIndex ? " on" : ""}`}
                    role="menuitem"
                    onMouseEnter={() => setCmdIndex(i)}
                    onClick={() => insertSlash(c.name)}
                  >
                    <span className="cmd">/{c.name}{c.source === "skill" && <span className="cmd-badge">skill</span>}</span>
                    <span className="desc">{c.description}</span>
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

          {/* Model selector */}
          <div className="menu-anchor">
            <button
              type="button"
              className={`cbtn${openMenu === "model" ? " active" : ""}`}
              aria-label="Model selector"
              onClick={() => setOpenMenu(openMenu === "model" ? null : "model")}
            >
              <span className="model-label">
                {currentModel && currentModel.isDefault
                  ? <>Default <span className="model-name">({modelDisplayName(currentModel)})</span></>
                  : <>{currentModel ? modelDisplayName(currentModel) : "Model"}</>}
              </span>
              <span className="chev">˅</span>
            </button>
            {openMenu === "model" && (
              <div className="popmenu align-right model-menu" role="menu">
                <div className="popmenu-head">Model</div>
                {models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`popmenu-item${m.id === model ? " on" : ""}`}
                    role="menuitem"
                    onClick={() => { setModel(m.id); setOpenMenu(null); }}
                  >
                    <span className="cmd">
                      {modelDisplayName(m)}
                      {m.isDefault && <span className="default-tag">Default</span>}
                    </span>
                    <span className="desc">{m.provider ?? ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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
