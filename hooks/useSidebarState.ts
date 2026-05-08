"use client";
import { useEffect, useState } from "react";

const KEY = "clawapp.sidebars";
type State = { left: boolean; right: boolean };

function load(): State {
  if (typeof window === "undefined") return { left: true, right: true };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { left: true, right: true };
    const parsed = JSON.parse(raw);
    return {
      left: typeof parsed.left === "boolean" ? parsed.left : true,
      right: typeof parsed.right === "boolean" ? parsed.right : true,
    };
  } catch {
    return { left: true, right: true };
  }
}

export function useSidebarState() {
  const [state, setState] = useState<State>(() => load());

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    }
  }, [state]);

  return {
    left: state.left,
    right: state.right,
    setLeft: (v: boolean) => setState((s) => ({ ...s, left: v })),
    setRight: (v: boolean) => setState((s) => ({ ...s, right: v })),
    toggleLeft: () => setState((s) => ({ ...s, left: !s.left })),
    toggleRight: () => setState((s) => ({ ...s, right: !s.right })),
  };
}
