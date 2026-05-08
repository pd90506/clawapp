import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useActiveTab } from "./useActiveTab";

beforeEach(() => {
  // jsdom default URL is http://localhost/
  window.history.replaceState(null, "", "/");
});

describe("useActiveTab", () => {
  it("defaults to chat when no query", () => {
    const { result } = renderHook(() => useActiveTab());
    expect(result.current.tab).toBe("chat");
  });
  it("reads channels when ?tab=channels", () => {
    window.history.replaceState(null, "", "/?tab=channels");
    const { result } = renderHook(() => useActiveTab());
    expect(result.current.tab).toBe("channels");
  });
});
