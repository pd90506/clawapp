import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionCard } from "./SessionCard";

describe("SessionCard", () => {
  const session = { id: "web:abc", title: "New chat", agentId: "main", model: "kimi/kimi-code", at: Date.now() - 5_000 };
  const noop = () => {};

  it("renders title, subtitle and avatar initial", () => {
    render(<SessionCard session={session} active={false} pinned={false} onSelect={noop} onTogglePin={noop} onDelete={noop} />);
    expect(screen.getByText("New chat")).toBeInTheDocument();
    expect(screen.getByText(/main · kimi\/kimi-code · now/)).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("shows active state with bullet", () => {
    const { container } = render(<SessionCard session={session} active={true} pinned={false} onSelect={noop} onTogglePin={noop} onDelete={noop} />);
    expect(container.querySelector('[aria-label="active session"]')).not.toBeNull();
  });

  it("calls onSelect when clicked", async () => {
    const onSelect = vi.fn();
    render(<SessionCard session={session} active={false} pinned={false} onSelect={onSelect} onTogglePin={noop} onDelete={noop} />);
    await userEvent.click(screen.getByText("New chat"));
    expect(onSelect).toHaveBeenCalledWith("web:abc");
  });

  describe("delete affordance", () => {
    let confirmSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => { confirmSpy = vi.spyOn(window, "confirm"); });
    afterEach(() => { confirmSpy.mockRestore(); });

    it("calls onDelete when × clicked and user confirms", async () => {
      confirmSpy.mockReturnValue(true);
      const onDelete = vi.fn();
      const onSelect = vi.fn();
      render(<SessionCard session={session} active={false} pinned={false} onSelect={onSelect} onTogglePin={noop} onDelete={onDelete} />);
      await userEvent.click(screen.getByRole("button", { name: /delete chat/i }));
      expect(onDelete).toHaveBeenCalledWith("web:abc");
      expect(onSelect).not.toHaveBeenCalled(); // click shouldn't bubble to card
    });

    it("does not call onDelete when user cancels", async () => {
      confirmSpy.mockReturnValue(false);
      const onDelete = vi.fn();
      render(<SessionCard session={session} active={false} pinned={false} onSelect={noop} onTogglePin={noop} onDelete={onDelete} />);
      await userEvent.click(screen.getByRole("button", { name: /delete chat/i }));
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});
