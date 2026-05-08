"use client";
import { AgentPicker } from "@/components/agent/AgentPicker";

type Props = { selectedAgent: string; onSelectAgent: (id: string) => void };

export function EmptyHero({ selectedAgent, onSelectAgent }: Props) {
  return (
    <div className="thread">
      <div className="empty" style={{ height: "100%" }}>
        <div>
          <h2>What are we chatting about today?</h2>
          <p>Send a message to start. Connect to the gateway above for live responses.</p>
          <div style={{ marginTop: 20 }}>
            <AgentPicker selected={selectedAgent} onSelect={onSelectAgent} />
          </div>
        </div>
      </div>
    </div>
  );
}
