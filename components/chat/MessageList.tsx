"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { ChatMessage, Status } from "@/hooks/useChat";
import { Message } from "./Message";
import { StreamingMessage } from "./StreamingMessage";

// useLayoutEffect positions the scroll before the browser paints (no flash),
// but warns during SSR — fall back to useEffect on the server.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// How close to the bottom (px) still counts as "pinned". If the user scrolls up
// further than this we stop auto-following so they can read history in peace.
const STICK_THRESHOLD = 80;

type GroupedMessage = { dayLabel: string | null; message: ChatMessage };

function groupByDay(messages: ChatMessage[]): GroupedMessage[] {
  // ChatMessage doesn't carry per-message timestamps yet; day dividers are
  // rendered when dayLabel is set — infrastructure ready for future timestamps.
  return messages.map((message) => ({ dayLabel: null, message }));
}

export function MessageList({ messages, status, sessionId, agentName, agentAvatarUrl }: { messages: ChatMessage[]; status: Status; sessionId: string; agentName?: string; agentAvatarUrl?: string }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const prevSessionRef = useRef<string | null>(null);
  // Whether we should keep the view pinned to the bottom. Starts true so a freshly
  // opened conversation lands at the latest message.
  const stickRef = useRef(true);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    // Always instant: deferring to the container's CSS `scroll-behavior: smooth`
    // produced the visible top→bottom crawl on tab switch.
    el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
  };

  // Track whether the user is parked near the bottom; if they scroll up to read
  // history we release the pin until they return.
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = distanceFromBottom <= STICK_THRESHOLD;
  };

  // On a session switch (or message change) re-pin to the bottom. A switch always
  // re-pins; within the same conversation we only follow if the user was already
  // at the bottom.
  useIsomorphicLayoutEffect(() => {
    const switched = prevSessionRef.current !== sessionId;
    prevSessionRef.current = sessionId;
    if (switched) stickRef.current = true;
    if (stickRef.current) scrollToBottom();
  }, [messages, sessionId]);

  // Message content (markdown, async code highlighting, images) can grow in
  // height AFTER mount — a one-shot scroll would then land short of the bottom.
  // Observe the content box and keep it pinned while sticking.
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stickRef.current) scrollToBottom();
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const grouped = groupByDay(messages);
  // Only show day divider if there are multiple distinct days —
  // since ChatMessage has no timestamp we skip for now.
  const showDividers = false;

  return (
    <div className="thread" ref={scrollRef} onScroll={handleScroll}>
      <div className="thread-inner" ref={innerRef}>
        {grouped.map(({ dayLabel, message }, i) => {
          if (message.divider) {
            return (
              <div key={message.id} className="session-divider">
                <span>{message.divider}</span>
              </div>
            );
          }
          const isLastAssistant = message.role === "assistant" && i === grouped.length - 1;
          const rendered = (isLastAssistant && status === "streaming")
            ? <StreamingMessage key={message.id} message={message} agentName={agentName} agentAvatarUrl={agentAvatarUrl} />
            : <Message key={message.id} message={message} agentName={agentName} agentAvatarUrl={agentAvatarUrl} />;
          return (
            <div key={message.id}>
              {showDividers && dayLabel && (
                <div className="day-divider">{dayLabel}</div>
              )}
              {rendered}
            </div>
          );
        })}
      </div>
    </div>
  );
}
