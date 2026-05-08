"use client";

export function ChannelsComingSoon() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="max-w-md p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-soft)]">
        <h2 className="text-lg font-medium mb-2">Channels are coming</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Connect Telegram, Slack, and other inboxes here. v1.3.
        </p>
      </div>
    </div>
  );
}
