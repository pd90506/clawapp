const PALETTE = [
  "#4a6b8a", "#7a8a4a", "#8a4a6b", "#6b4a8a",
  "#8a6b4a", "#4a8a8a", "#8a4a4a", "#4a8a4a",
];

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return Math.abs(h);
}

export function agentVisual(agentId: string): { color: string; initial: string } {
  const color = PALETTE[hash(agentId) % PALETTE.length];
  const initial = (agentId[0] ?? "?").toUpperCase();
  return { color, initial };
}
