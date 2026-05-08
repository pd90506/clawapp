"use client";
import { useEffect, useState } from "react";

export type Health = { ok: boolean; reason?: string } | null;

export function useGatewayHealth(): Health {
  const [state, setState] = useState<Health>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/health");
        const j = await r.json();
        if (!cancelled) setState(j);
      } catch {
        if (!cancelled) setState({ ok: false, reason: "fetch failed" });
      }
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return state;
}
