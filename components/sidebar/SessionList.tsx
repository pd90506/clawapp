"use client";
import { useEffect, useState } from "react";
import { SessionCard, type SessionView } from "./SessionCard";
import { SessionGroup } from "./SessionGroup";

type Props = {
  activeSessionId: string | null;
  pinnedIds: Set<string>;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  now?: number;
};

type RawSession = { id: string; title: string; agentId?: string; model?: string; updatedAt?: number; at?: number };

const POLL_MS = 30_000;

export function SessionList({ activeSessionId, pinnedIds, onSelect, onTogglePin, now }: Props) {
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  const [mountNow] = useState<number>(() => now ?? Date.now());
  const referenceNow = now ?? mountNow;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/sessions");
        const j = await r.json();
        if (cancelled) return;
        setSessions((j.sessions as RawSession[]).map((s) => ({
          id: s.id,
          title: s.title || "(untitled)",
          agentId: s.agentId ?? extractAgentFromId(s.id),
          model: s.model,
          at: s.updatedAt ?? s.at ?? referenceNow,
        })));
      } catch {
        if (!cancelled) setSessions([]);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [referenceNow]);

  if (sessions === null) return <div className="px-3 py-2 text-xs text-[var(--text-faint)]">Loading…</div>;
  if (sessions.length === 0) return <div className="px-3 py-2 text-xs text-[var(--text-faint)]">No sessions yet</div>;

  const groups = bucket(sessions, pinnedIds, referenceNow);

  return (
    <div>
      {groups.map(([title, items]) => items.length > 0 && (
        <SessionGroup key={title} title={title}>
          {items.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              active={s.id === activeSessionId}
              pinned={pinnedIds.has(s.id)}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
            />
          ))}
        </SessionGroup>
      ))}
    </div>
  );
}

function extractAgentFromId(id: string): string {
  // e.g. "agent:main:main" → "main"
  const m = id.match(/^agent:([^:]+)/);
  return m?.[1] ?? "main";
}

function bucket(sessions: SessionView[], pinned: Set<string>, now: number): [string, SessionView[]][] {
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday.getTime() - 24 * 3600_000);
  const startWeek = new Date(startToday.getTime() - 6 * 24 * 3600_000);

  const pinnedItems: SessionView[] = [];
  const today: SessionView[] = [];
  const yesterday: SessionView[] = [];
  const thisWeek: SessionView[] = [];
  const older: SessionView[] = [];

  const sorted = [...sessions].sort((a, b) => b.at - a.at);
  for (const s of sorted) {
    if (pinned.has(s.id)) { pinnedItems.push(s); continue; }
    if (s.at >= startToday.getTime()) today.push(s);
    else if (s.at >= startYesterday.getTime()) yesterday.push(s);
    else if (s.at >= startWeek.getTime()) thisWeek.push(s);
    else older.push(s);
  }
  return [
    ["Pinned", pinnedItems],
    ["Today", today],
    ["Yesterday", yesterday],
    ["This week", thisWeek],
    ["Older", older],
  ];
}
