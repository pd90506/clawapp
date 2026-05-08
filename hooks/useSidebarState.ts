"use client";
import { useEffect, useState } from "react";

const KEY = "clawapp.sidebars";
type State = { left: boolean; right: boolean };
const DEFAULT: State = { left: true, right: true };

function readStorage(): State {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return {
      left: typeof parsed.left === "boolean" ? parsed.left : true,
      right: typeof parsed.right === "boolean" ? parsed.right : true,
    };
  } catch {
    return DEFAULT;
  }
}

export function useSidebarState() {
  // Avoid SSR/CSR mismatch: render with defaults, hydrate from storage after mount.
  const [state, setState] = useState<State>(DEFAULT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next = readStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(next);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    }
  }, [state, hydrated]);

  return {
    left: state.left,
    right: state.right,
    setLeft: (v: boolean) => setState((s) => ({ ...s, left: v })),
    setRight: (v: boolean) => setState((s) => ({ ...s, right: v })),
    toggleLeft: () => setState((s) => ({ ...s, left: !s.left })),
    toggleRight: () => setState((s) => ({ ...s, right: !s.right })),
  };
}
