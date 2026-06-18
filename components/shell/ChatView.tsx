"use client";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { EmptyHero } from "@/components/shell/EmptyHero";
import { useChat } from "@/hooks/useChat";
import { useAgentNames } from "@/hooks/useAgentNames";
import { useAgentAvatars } from "@/hooks/useAgentAvatars";
import { agentIdFromSessionKey } from "@/lib/agentVisuals";

type Props = {
  sessionId: string | null;
  selectedAgent: string;
  onSelectAgent: (id: string) => void;
  composerDisabled: boolean;
  onTurnComplete?: () => void;
};

export function ChatView({ sessionId, selectedAgent, onSelectAgent, composerDisabled, onTurnComplete }: Props) {
  if (!sessionId) {
    return <EmptyHero selectedAgent={selectedAgent} onSelectAgent={onSelectAgent} />;
  }
  return <ActiveChat sessionId={sessionId} composerDisabled={composerDisabled} onTurnComplete={onTurnComplete} />;
}

function ActiveChat({ sessionId, composerDisabled, onTurnComplete }: { sessionId: string; composerDisabled: boolean; onTurnComplete?: () => void }) {
  const { messages, status, send } = useChat(sessionId, onTurnComplete);
  const isStreaming = status === "streaming";
  // Identify the agent behind this session so assistant rows show the name the
  // user set (nickname → falls back to the real agent id) and their avatar.
  const { names } = useAgentNames();
  const { avatars } = useAgentAvatars();
  const agentId = agentIdFromSessionKey(sessionId);
  const agentName = (agentId && (names[agentId]?.trim() || agentId)) || "Assistant";
  const agentAvatarUrl = agentId ? avatars[agentId] : undefined;
  return (
    <div className="thread-wrap" style={{ display: "grid", gridTemplateRows: "1fr auto", minHeight: 0 }}>
      <MessageList messages={messages} status={status} sessionId={sessionId} agentName={agentName} agentAvatarUrl={agentAvatarUrl} />
      <Composer
        onSend={send}
        disabled={composerDisabled || isStreaming}
        streaming={isStreaming}
      />
    </div>
  );
}
