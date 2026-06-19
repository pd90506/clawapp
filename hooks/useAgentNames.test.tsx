import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentNames } from "./useAgentNames";

describe("useAgentNames", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts empty and stores a rename", () => {
    const { result } = renderHook(() => useAgentNames());
    expect(result.current.names).toEqual({});
    act(() => result.current.rename("main", "Stelle"));
    expect(result.current.names).toEqual({ main: "Stelle" });
    expect(JSON.parse(window.localStorage.getItem("clawapp.agentNames")!)).toEqual({ main: "Stelle" });
  });

  it("trims, and a blank name clears the override", () => {
    const { result } = renderHook(() => useAgentNames());
    act(() => result.current.rename("main", "  Stelle  "));
    expect(result.current.names).toEqual({ main: "Stelle" });
    act(() => result.current.rename("main", "   "));
    expect(result.current.names).toEqual({});
  });

  it("hydrates from localStorage on mount", () => {
    window.localStorage.setItem("clawapp.agentNames", JSON.stringify({ "silver-wolf": "Wolf" }));
    const { result } = renderHook(() => useAgentNames());
    expect(result.current.names).toEqual({ "silver-wolf": "Wolf" });
  });
});
