import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Message } from "./Message";

describe("Message", () => {
  it("renders text block as markdown", () => {
    render(<Message message={{
      id: "m1", role: "assistant", blocks: [{ kind: "text", md: "**hi**" }],
    }} />);
    expect(screen.getByText("hi").tagName).toBe("STRONG");
  });
  it("renders tool_call block via ToolCallPanel", () => {
    render(<Message message={{
      id: "m1", role: "assistant",
      blocks: [{ kind: "tool_call", id: "t", name: "search", args: {}, done: true, result: "ok" }],
    }} />);
    expect(screen.getByText("search", { exact: false })).toBeInTheDocument();
  });
  it("renders thinking block via ThinkingPanel", () => {
    render(<Message message={{
      id: "m1", role: "assistant", blocks: [{ kind: "thinking", text: "x", done: true }],
    }} />);
    expect(screen.getByText(/Thoughts/)).toBeInTheDocument();
  });
  it("shows error footer when message errored", () => {
    render(<Message message={{
      id: "m1", role: "assistant", blocks: [], error: "boom",
    }} />);
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });
  it("assistant message renders a Copy-message button", () => {
    render(<Message message={{
      id: "m1", role: "assistant", blocks: [{ kind: "text", md: "hello" }],
    }} />);
    expect(screen.getByRole("button", { name: /copy message/i })).toBeInTheDocument();
  });
  it("user message does NOT render a copy-message button", () => {
    render(<Message message={{
      id: "m2", role: "user", blocks: [{ kind: "text", md: "hi" }],
    }} />);
    expect(screen.queryByRole("button", { name: /copy message/i })).toBeNull();
  });
});
