import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./useRelativeTime";

const NOW = new Date("2026-05-08T12:00:00Z").getTime();

describe("formatRelativeTime", () => {
  it("returns 'now' under a minute", () => {
    expect(formatRelativeTime(NOW - 5000, NOW)).toBe("now");
  });
  it("returns minutes under an hour", () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe("5m");
  });
  it("returns hours under a day (same calendar day)", () => {
    expect(formatRelativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3h");
  });
  it("returns 'yesterday' for previous day", () => {
    expect(formatRelativeTime(NOW - 26 * 3_600_000, NOW)).toBe("yesterday");
  });
  it("returns 'Nd' for older within a week", () => {
    expect(formatRelativeTime(NOW - 4 * 24 * 3_600_000, NOW)).toBe("4d");
  });
  it("returns absolute date for older than a week", () => {
    const out = formatRelativeTime(NOW - 30 * 24 * 3_600_000, NOW);
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
