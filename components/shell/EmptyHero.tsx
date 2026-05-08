"use client";
import { AgentPicker } from "@/components/agent/AgentPicker";

type Props = { selectedAgent: string; onSelectAgent: (id: string) => void };

export function EmptyHero({ selectedAgent, onSelectAgent }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div
        aria-hidden
        className="w-32 h-32 rounded-full bg-[var(--bg-card)] border border-[var(--border-soft)] mb-6 grid place-items-center"
      >
        <span className="text-5xl text-[var(--accent)]">◐</span>
      </div>
      <h1 className="text-xl font-medium text-[var(--text-primary)] mb-6">
        What are we chatting about today?
      </h1>
      <AgentPicker selected={selectedAgent} onSelect={onSelectAgent} />
    </div>
  );
}
