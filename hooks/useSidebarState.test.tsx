import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarState } from "./useSidebarState";

beforeEach(() => { localStorage.clear(); });

describe("useSidebarState", () => {
  it("defaults to both open", () => {
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.left).toBe(true);
    expect(result.current.right).toBe(true);
  });
  it("toggle persists to localStorage", () => {
    const { result } = renderHook(() => useSidebarState());
    act(() => { result.current.setLeft(false); });
    expect(JSON.parse(localStorage.getItem("clawapp.sidebars") ?? "{}").left).toBe(false);
  });
  it("rehydrates from localStorage", () => {
    localStorage.setItem("clawapp.sidebars", JSON.stringify({ left: false, right: true }));
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.left).toBe(false);
    expect(result.current.right).toBe(true);
  });
});
