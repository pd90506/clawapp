import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePinnedSessions } from "./usePinnedSessions";

beforeEach(() => { localStorage.clear(); });

describe("usePinnedSessions", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => usePinnedSessions());
    expect(result.current.isPinned("any")).toBe(false);
    expect(result.current.pinnedIds.has("any")).toBe(false);
  });
  it("toggles pinned state and persists", () => {
    const { result } = renderHook(() => usePinnedSessions());
    act(() => { result.current.togglePin("s1"); });
    expect(result.current.isPinned("s1")).toBe(true);
    expect(result.current.pinnedIds.has("s1")).toBe(true);
    act(() => { result.current.togglePin("s1"); });
    expect(result.current.isPinned("s1")).toBe(false);
    expect(result.current.pinnedIds.has("s1")).toBe(false);
  });
  it("rehydrates from localStorage", () => {
    localStorage.setItem("clawapp.pinned", JSON.stringify(["s1", "s2"]));
    const { result } = renderHook(() => usePinnedSessions());
    expect(result.current.pinnedIds.has("s1")).toBe(true);
    expect(result.current.pinnedIds.has("s2")).toBe(true);
    expect(result.current.pinnedIds.has("s3")).toBe(false);
  });
});
