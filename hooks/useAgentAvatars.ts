"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "clawapp.agentAvatars";

// App-local avatars for agents, keyed by agentId, stored as small data URLs in
// localStorage (mirrors useAgentNames). Cosmetic only — never touches identity.
function readStorage(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? (obj as Record<string, string>) : {};
  } catch { return {}; }
}

export function useAgentAvatars() {
  const [avatars, setAvatars] = useState<Record<string, string>>(() => ({}));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next = readStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Object.keys(next).length > 0) setAvatars(next);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(KEY, JSON.stringify(avatars)); }
      catch { /* quota — non-fatal; avatar just won't persist */ }
    }
  }, [avatars, hydrated]);

  const setAvatar = useCallback((agentId: string, dataUrl: string) => {
    setAvatars((prev) => ({ ...prev, [agentId]: dataUrl }));
  }, []);

  const clearAvatar = useCallback((agentId: string) => {
    setAvatars((prev) => {
      const next = { ...prev };
      delete next[agentId];
      return next;
    });
  }, []);

  return { avatars, setAvatar, clearAvatar };
}
