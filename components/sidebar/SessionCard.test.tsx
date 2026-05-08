import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionCard } from "./SessionCard";

describe("SessionCard", () => {
  const session = { id: "web:abc", title: "New chat", agentId: "main", model: "kimi/kimi-code", at: Date.now() - 5_000 };

  it("renders title, subtitle and avatar initial", () => {
    render(<SessionCard session={session} active={false} pinned={false} onSelect={() => {}} onTogglePin={() => {}} />);
    expect(screen.getByText("New chat")).toBeInTheDocument();
    expect(screen.getByText(/main · kimi\/kimi-code · now/)).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("shows active state with bullet", () => {
    const { container } = render(<SessionCard session={session} active={true} pinned={false} onSelect={() => {}} onTogglePin={() => {}} />);
    expect(container.querySelector('[aria-label="active session"]')).not.toBeNull();
  });

  it("calls onSelect when clicked", async () => {
    const onSelect = vi.fn();
    render(<SessionCard session={session} active={false} pinned={false} onSelect={onSelect} onTogglePin={() => {}} />);
    await userEvent.click(screen.getByText("New chat"));
    expect(onSelect).toHaveBeenCalledWith("web:abc");
  });
});
