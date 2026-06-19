// A session "family" is the chain of app-owned sessions for one agent. The
// original is `app:<agent>` (gateway-namespaced `agent:<agent>:app:<agent>`);
// each `/new` mints a fresh member `app:<agent>:<ms>` whose numeric suffix is its
// creation time. The suffix doubles as a stable sort key, so the newest member
// (the active session) is recoverable from `sessions.list` alone — no client
// state, reload-/multi-device-safe.

// The agent id for any family member, namespaced or bare, or null if the key
// isn't an app-family session (e.g. a Telegram surface session).
export function familyAgentId(key: string | null): string | null {
  if (!key) return null;
  return (
    key.match(/^agent:([^:]+):app:\1(?::\d+)?$/)?.[1] ??
    key.match(/^app:([^:]+)(?::\d+)?$/)?.[1] ??
    null
  );
}

// Creation-order key embedded in the suffix; the original (no suffix) is 0.
export function familySeq(key: string): number {
  const m = key.match(/^(?:agent:[^:]+:)?app:[^:]+:(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export function isFamilyMember(key: string, agentId: string): boolean {
  return familyAgentId(key) === agentId;
}

// The original (seq 0) member key for an agent.
export function appSessionKey(agentId: string): string {
  return `app:${agentId}`;
}

// A fresh member key stamped with its creation time (the active session after /new).
export function newFamilyKey(agentId: string, nowMs: number): string {
  return `app:${agentId}:${nowMs}`;
}

// Oldest→newest family members from a session list, by embedded seq.
export function orderFamily<T extends { id: string }>(sessions: T[], agentId: string): T[] {
  return sessions
    .filter((s) => isFamilyMember(s.id, agentId))
    .sort((a, b) => familySeq(a.id) - familySeq(b.id));
}
