"use client";
import { useEffect, useState } from "react";

export function StatusBanner() {
  const [state, setState] = useState<{ ok: boolean; reason?: string } | null>(null);
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
  if (!state || state.ok) return null;
  return (
    <div role="alert" className="bg-red-600 text-white text-sm px-3 py-2">
      openclaw gateway unreachable{state.reason ? ` — ${state.reason}` : ""}
    </div>
  );
}
