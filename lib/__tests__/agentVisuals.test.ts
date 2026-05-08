import { describe, it, expect } from "vitest";
import { agentVisual } from "../agentVisuals";

describe("agentVisual", () => {
  it("returns a color and initial for an id", () => {
    const v = agentVisual("main");
    expect(v.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(v.initial).toBe("M");
  });
  it("returns the same color for the same id (deterministic)", () => {
    expect(agentVisual("foo").color).toBe(agentVisual("foo").color);
  });
  it("returns different colors for different ids (most pairs)", () => {
    const ids = ["main", "alpha", "beta", "gamma", "delta"];
    const colors = new Set(ids.map((id) => agentVisual(id).color));
    expect(colors.size).toBeGreaterThan(1);
  });
  it("uppercases first letter for initial", () => {
    expect(agentVisual("zen").initial).toBe("Z");
  });
});
