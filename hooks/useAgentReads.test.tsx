import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentReads } from "./useAgentReads";

describe("useAgentReads", () => {
  beforeEach(() => window.localStorage.clear());

  it("records a read marker and persists it", () => {
    const { result } = renderHook(() => useAgentReads());
    act(() => result.current.markRead("main", 1000));
    expect(result.current.reads).toEqual({ main: 1000 });
    expect(JSON.parse(window.localStorage.getItem("clawapp.agentReads")!)).toEqual({ main: 1000 });
  });

  it("never moves the marker backwards", () => {
    const { result } = renderHook(() => useAgentReads());
    act(() => result.current.markRead("main", 2000));
    act(() => result.current.markRead("main", 1500));
    expect(result.current.reads).toEqual({ main: 2000 });
  });

  it("hydrates from localStorage", () => {
    window.localStorage.setItem("clawapp.agentReads", JSON.stringify({ "silver-wolf": 5 }));
    const { result } = renderHook(() => useAgentReads());
    expect(result.current.reads).toEqual({ "silver-wolf": 5 });
  });
});
