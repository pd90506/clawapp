"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "clawapp.pinned";

function readStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

export function usePinnedSessions() {
  // Avoid SSR/CSR mismatch: start empty, hydrate from storage after mount.
  const [pinned, setPinned] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next = readStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next.size > 0) setPinned(next);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify([...pinned]));
    }
  }, [pinned, hydrated]);

  const isPinned = useCallback((id: string) => pinned.has(id), [pinned]);
  const togglePin = useCallback((id: string) => {
    setPinned((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  return { isPinned, togglePin, pinnedIds: pinned };
}
