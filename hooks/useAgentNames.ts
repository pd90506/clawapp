"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "clawapp.agentNames";

// App-local display names for agents, keyed by agentId. This never touches the
// agent's real identity (id / session keys) — it's purely how THIS app labels
// the row, persisted in localStorage like pins.
function readStorage(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? (obj as Record<string, string>) : {};
  } catch { return {}; }
}

export function useAgentNames() {
  // Avoid SSR/CSR mismatch: start empty, hydrate from storage after mount.
  const [names, setNames] = useState<Record<string, string>>(() => ({}));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next = readStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Object.keys(next).length > 0) setNames(next);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify(names));
    }
  }, [names, hydrated]);

  // Set a custom name; an empty/blank name clears the override (revert to id).
  const rename = useCallback((agentId: string, name: string) => {
    const trimmed = name.trim();
    setNames((prev) => {
      const next = { ...prev };
      if (trimmed) next[agentId] = trimmed;
      else delete next[agentId];
      return next;
    });
  }, []);

  return { names, rename };
}
