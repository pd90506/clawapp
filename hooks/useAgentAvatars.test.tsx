import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentAvatars } from "./useAgentAvatars";

const DATA = "data:image/jpeg;base64,AAAA";

describe("useAgentAvatars", () => {
  beforeEach(() => window.localStorage.clear());

  it("stores and clears an avatar, persisting to localStorage", () => {
    const { result } = renderHook(() => useAgentAvatars());
    expect(result.current.avatars).toEqual({});
    act(() => result.current.setAvatar("main", DATA));
    expect(result.current.avatars).toEqual({ main: DATA });
    expect(JSON.parse(window.localStorage.getItem("clawapp.agentAvatars")!)).toEqual({ main: DATA });
    act(() => result.current.clearAvatar("main"));
    expect(result.current.avatars).toEqual({});
  });

  it("hydrates from localStorage on mount", () => {
    window.localStorage.setItem("clawapp.agentAvatars", JSON.stringify({ "silver-wolf": DATA }));
    const { result } = renderHook(() => useAgentAvatars());
    expect(result.current.avatars).toEqual({ "silver-wolf": DATA });
  });
});
