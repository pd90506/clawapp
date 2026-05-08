"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "clawapp.pinned";

function load(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

export function usePinnedSessions() {
  const [pinned, setPinned] = useState<Set<string>>(() => load());

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify([...pinned]));
    }
  }, [pinned]);

  const isPinned = useCallback((id: string) => pinned.has(id), [pinned]);
  const togglePin = useCallback((id: string) => {
    setPinned((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  return { isPinned, togglePin };
}
