"use client";
import { useEffect, useState } from "react";

const KEY = "clawapp.layoutWidths";
const DEFAULTS = { leftWidth: 260, rightWidth: 280 };

function readStorage(): { leftWidth: number; rightWidth: number } {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      leftWidth: typeof parsed.leftWidth === "number" ? parsed.leftWidth : DEFAULTS.leftWidth,
      rightWidth: typeof parsed.rightWidth === "number" ? parsed.rightWidth : DEFAULTS.rightWidth,
    };
  } catch {
    return DEFAULTS;
  }
}

export function useLayoutWidths() {
  const [widths, setWidths] = useState(DEFAULTS);

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidths(readStorage());
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify(widths));
    }
  }, [widths]);

  return {
    leftWidth: widths.leftWidth,
    rightWidth: widths.rightWidth,
    setLeftWidth: (v: number) => setWidths((s) => ({ ...s, leftWidth: v })),
    setRightWidth: (v: number) => setWidths((s) => ({ ...s, rightWidth: v })),
  };
}
