"use client";
import { useState } from "react";
import { useChat } from "@/hooks/useChat";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { StatusBanner } from "@/components/connection/StatusBanner";
import type { SessionSummary } from "@/lib/openclaw";

type Props = { initialSessionId: string | null; sessions: SessionSummary[] };

export function ChatPage({ initialSessionId, sessions }: Props) {
  const [sessionId, setSessionId] = useState(initialSessionId ?? "default");
  const { messages, status, send } = useChat(sessionId);

  return (
    <div className="h-full flex flex-col">
      <StatusBanner />
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r overflow-y-auto p-2 hidden md:block">
          <div className="text-xs uppercase text-zinc-500 px-2 py-1">Sessions</div>
          {sessions.length === 0 && <div className="px-2 text-sm text-zinc-500">No sessions yet</div>}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setSessionId(s.id)}
              className={`w-full text-left px-2 py-1 rounded text-sm truncate ${
                s.id === sessionId ? "bg-zinc-200 dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              {s.title || s.id}
            </button>
          ))}
        </aside>
        <main className="flex-1 flex flex-col">
          <MessageList messages={messages} status={status} />
          <Composer onSend={send} disabled={status === "streaming"} />
        </main>
      </div>
    </div>
  );
}
