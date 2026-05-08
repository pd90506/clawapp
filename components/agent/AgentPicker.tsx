"use client";
import { useEffect, useState } from "react";
import { agentVisual } from "@/lib/agentVisuals";

type Agent = { id: string; label: string };

type Props = { selected: string; onSelect: (id: string) => void };

export function AgentPicker({ selected, onSelect }: Props) {
  const [agents, setAgents] = useState<Agent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agents")
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setAgents(j.agents ?? []); })
      .catch(() => { if (!cancelled) setAgents([{ id: "main", label: "Default" }]); });
    return () => { cancelled = true; };
  }, []);

  if (!agents) return <div className="h-10" />;
  if (agents.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {agents.map((a) => {
        const v = agentVisual(a.id);
        const active = a.id === selected;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
              active
                ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]"
                : "bg-[var(--bg-card)] border-[var(--border-soft)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <span
              aria-hidden
              className="inline-block w-5 h-5 rounded-full text-[10px] text-white grid place-items-center"
              style={{ background: v.color }}
            >
              {v.initial}
            </span>
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
