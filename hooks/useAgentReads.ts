"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "clawapp.agentReads";

// Tracks the last `updatedAt` the user has "seen" for each agent's app session
// (localStorage, mirrors the other app-local hooks). An agent is unread when its
// session's current updatedAt exceeds this. Cosmetic, app-local.
function readStorage(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? (obj as Record<string, number>) : {};
  } catch { return {}; }
}

export function useAgentReads() {
  const [reads, setReads] = useState<Record<string, number>>(() => ({}));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next = readStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Object.keys(next).length > 0) setReads(next);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(KEY, JSON.stringify(reads)); }
      catch { /* non-fatal */ }
    }
  }, [reads, hydrated]);

  // Mark an agent read up to `ts`. Never moves the marker backwards.
  const markRead = useCallback((agentId: string, ts: number) => {
    setReads((prev) => (prev[agentId] != null && prev[agentId] >= ts ? prev : { ...prev, [agentId]: ts }));
  }, []);

  return { reads, hydrated, markRead };
}
