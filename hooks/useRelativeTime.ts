export function formatRelativeTime(at: number, now: number = Date.now()): string {
  const diffMs = now - at;
  if (diffMs < 60_000) return "now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m`;
  const sameDay = new Date(at).toDateString() === new Date(now).toDateString();
  if (sameDay) return `${Math.floor(diffMs / 3_600_000)}h`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (new Date(at).toDateString() === yesterday.toDateString()) return "yesterday";
  const days = Math.floor(diffMs / (24 * 3_600_000));
  if (days < 7) return `${days}d`;
  // Absolute date YYYY-MM-DD
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
