"use client";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { EmptyHero } from "@/components/shell/EmptyHero";
import { useChat } from "@/hooks/useChat";

type Props = {
  sessionId: string | null;
  selectedAgent: string;
  onSelectAgent: (id: string) => void;
  modelLabel?: string;
  composerDisabled: boolean;
};

export function ChatView({ sessionId, selectedAgent, onSelectAgent, modelLabel, composerDisabled }: Props) {
  if (!sessionId) {
    return <EmptyHero selectedAgent={selectedAgent} onSelectAgent={onSelectAgent} />;
  }
  return <ActiveChat sessionId={sessionId} modelLabel={modelLabel} composerDisabled={composerDisabled} />;
}

function ActiveChat({ sessionId, modelLabel, composerDisabled }: { sessionId: string; modelLabel?: string; composerDisabled: boolean }) {
  const { messages, status, send } = useChat(sessionId);
  const isStreaming = status === "streaming";
  return (
    <div className="thread-wrap" style={{ display: "grid", gridTemplateRows: "1fr auto", minHeight: 0 }}>
      <MessageList messages={messages} status={status} />
      <Composer
        onSend={send}
        disabled={composerDisabled || isStreaming}
        streaming={isStreaming}
        modelLabel={modelLabel}
      />
    </div>
  );
}
