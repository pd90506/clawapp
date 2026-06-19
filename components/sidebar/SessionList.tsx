"use client";
import { useEffect, useState } from "react";
import { SessionCard, type SessionView } from "./SessionCard";
import { useAgentNames } from "@/hooks/useAgentNames";
import { useAgentAvatars } from "@/hooks/useAgentAvatars";
import { useAgentReads } from "@/hooks/useAgentReads";
import { fileToAvatarDataUrl } from "@/lib/avatar";
import { familyAgentId } from "@/lib/openclaw/sessionFamily";

type Props = {
  activeSessionId: string | null;
  pinnedIds: Set<string>;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  refreshNonce?: number;
  now?: number;
};

type RawAgent = { id: string; label?: string };
type RawSession = { id: string; updatedAt?: number };

const POLL_MS = 8_000;
const APP_PREFIX = "app:";
// The gateway namespaces a created `app:<agent>` key under its agent, so the
// stored session key is `agent:<agent>:app:<agent>`. Use that canonical form as
// the row id so pin/delete target the real session.
const canonicalAppKey = (agentId: string) => `agent:${agentId}:${APP_PREFIX}${agentId}`;
const sessionAgent = (key: string | null): string | null => key?.match(/^agent:([^:]+):/)?.[1] ?? null;
// An agent's app session — any member of its `/new` chain (original or a
// time-stamped successor) maps back to the agent for activity/unread tracking.
const appSessionAgent = (key: string): string | null => familyAgentId(key);

// Telegram-style sidebar: one row per agent (a "contact"), each backed by that
// agent's single app-owned session `app:<agent>`. Rows come from the agent roster
// — NOT the gateway's session list — so the app never surfaces or targets another
// surface's session (e.g. a Telegram thread), which is what was thrashing the cache.
export function SessionList({ activeSessionId, pinnedIds, onSelect, onTogglePin, refreshNonce = 0, now }: Props) {
  const [agents, setAgents] = useState<SessionView[] | null>(null);
  // agentId → its app session's latest updatedAt (drives the unread dot).
  const [activity, setActivity] = useState<Record<string, number>>({});
  const [mountNow] = useState<number>(() => now ?? Date.now());
  const referenceNow = now ?? mountNow;
  const { names, rename } = useAgentNames();
  const { avatars, setAvatar, clearAvatar } = useAgentAvatars();
  const { reads, hydrated, markRead } = useAgentReads();

  const handleSetAvatar = async (agentId: string, file: File) => {
    try { setAvatar(agentId, await fileToAvatarDataUrl(file)); }
    catch { /* bad image — ignore */ }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [ar, sr] = await Promise.all([fetch("/api/agents"), fetch("/api/sessions")]);
        const aj = await ar.json();
        const sj = await sr.json().catch(() => ({ sessions: [] }));
        if (cancelled) return;
        setAgents((aj.agents as RawAgent[]).map((a) => ({
          id: canonicalAppKey(a.id),
          title: a.id, // default title; the nickname (if any) is applied at render
          agentId: a.id,
          at: referenceNow,
        })));
        const act: Record<string, number> = {};
        for (const s of (sj.sessions ?? []) as RawSession[]) {
          const agent = appSessionAgent(s.id);
          // An agent may own several chain members; track the most recent activity.
          if (agent && typeof s.updatedAt === "number") act[agent] = Math.max(act[agent] ?? 0, s.updatedAt);
        }
        setActivity(act);
      } catch {
        if (!cancelled) setAgents([]);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [referenceNow, refreshNonce]);

  // Baseline an agent's read marker on first sight (so existing activity isn't
  // flagged as unread), and keep the currently-open agent continuously read.
  useEffect(() => {
    if (!hydrated) return;
    const activeAgent = sessionAgent(activeSessionId);
    for (const [agent, ts] of Object.entries(activity)) {
      if (reads[agent] === undefined || agent === activeAgent) markRead(agent, ts);
    }
  }, [activity, reads, hydrated, activeSessionId, markRead]);

  if (agents === null) return <div className="px-3 py-2 text-xs text-[var(--text-faint)]">Loading…</div>;
  if (agents.length === 0) return <div className="px-3 py-2 text-xs text-[var(--text-faint)]">No agents</div>;

  // Pinned agents float to the top; otherwise roster order is preserved.
  const rows = [...agents].sort((a, b) => (pinnedIds.has(b.id) ? 1 : 0) - (pinnedIds.has(a.id) ? 1 : 0));

  const activeAgent = sessionAgent(activeSessionId);
  const isUnread = (agentId: string) =>
    agentId !== activeAgent &&
    activity[agentId] != null &&
    reads[agentId] != null &&
    activity[agentId] > reads[agentId];

  // Resolve (find-or-create) the agent's app session before activating it, so the
  // history fetch and subscribe target a session the gateway already knows about.
  const handleSelect = async (rowId: string) => {
    const agentId = sessionAgent(rowId) ?? (rowId.startsWith(APP_PREFIX) ? rowId.slice(APP_PREFIX.length) : rowId);
    markRead(agentId, activity[agentId] ?? Date.now()); // opening clears the unread dot
    try {
      const r = await fetch("/api/sessions/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      if (r.ok) {
        const j = await r.json();
        onSelect(j.id ?? rowId);
        return;
      }
    } catch { /* fall through to optimistic select on the deterministic key */ }
    onSelect(rowId);
  };

  return (
    <div>
      {rows.map((s) => (
        <SessionCard
          key={s.agentId}
          // Apply the app-local nickname at render (falls back to the agent id).
          session={{ ...s, title: names[s.agentId] ?? s.agentId }}
          // Match by agent, not raw key: the active session is the agent's
          // app session whatever exact key the gateway assigned it.
          active={s.id === activeSessionId || activeAgent === s.agentId}
          unread={isUnread(s.agentId)}
          pinned={pinnedIds.has(s.id)}
          avatarUrl={avatars[s.agentId]}
          onSelect={handleSelect}
          onTogglePin={onTogglePin}
          onRename={rename}
          onSetAvatar={handleSetAvatar}
          onClearAvatar={clearAvatar}
        />
      ))}
    </div>
  );
}
