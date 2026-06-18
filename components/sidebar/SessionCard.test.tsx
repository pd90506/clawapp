import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionCard } from "./SessionCard";

describe("SessionCard", () => {
  const session = { id: "web:abc", title: "New chat", agentId: "main", model: "kimi/kimi-code", at: Date.now() - 5_000 };
  const noop = () => {};

  it("renders nickname title, agent-id subtitle and avatar initial", () => {
    render(<SessionCard session={session} active={false} pinned={false} onSelect={noop} onTogglePin={noop} />);
    expect(screen.getByText("New chat")).toBeInTheDocument(); // title = nickname/display name
    expect(screen.getByText("main")).toBeInTheDocument();     // subtitle = real agent name (id)
    expect(screen.getByText("N")).toBeInTheDocument();        // avatar initial from display name
  });

  it("shows the active highlight (row class), without an unread dot", () => {
    const { container } = render(<SessionCard session={session} active={true} pinned={false} onSelect={noop} onTogglePin={noop} />);
    expect(container.querySelector(".convo.active")).not.toBeNull();
    expect(container.querySelector('[aria-label="unread messages"]')).toBeNull();
  });

  it("shows the unread dot only when unread", () => {
    const { container, rerender } = render(<SessionCard session={session} active={false} unread={false} pinned={false} onSelect={noop} onTogglePin={noop} />);
    expect(container.querySelector('[aria-label="unread messages"]')).toBeNull();
    rerender(<SessionCard session={session} active={false} unread={true} pinned={false} onSelect={noop} onTogglePin={noop} />);
    expect(container.querySelector('[aria-label="unread messages"]')).not.toBeNull();
  });

  it("calls onSelect when clicked", async () => {
    const onSelect = vi.fn();
    render(<SessionCard session={session} active={false} pinned={false} onSelect={onSelect} onTogglePin={noop} />);
    await userEvent.click(screen.getByText("New chat"));
    expect(onSelect).toHaveBeenCalledWith("web:abc");
  });

  it("has no delete affordance (agents can't be deleted here)", () => {
    render(<SessionCard session={session} active={false} pinned={false} onSelect={noop} onTogglePin={noop} />);
    expect(screen.queryByRole("button", { name: /delete chat/i })).toBeNull();
  });

  it("kebab menu → Rename → edit → Enter commits", async () => {
    const onRename = vi.fn();
    const onSelect = vi.fn();
    render(<SessionCard session={session} active={false} pinned={false} onSelect={onSelect} onTogglePin={noop} onRename={onRename} />);
    await userEvent.click(screen.getByRole("button", { name: /agent options/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /rename/i }));
    const input = screen.getByRole("textbox", { name: /rename agent/i });
    await userEvent.clear(input);
    await userEvent.type(input, "Stelle{Enter}");
    expect(onRename).toHaveBeenCalledWith("main", "Stelle");
    expect(onSelect).not.toHaveBeenCalled(); // opening the menu shouldn't select the row
  });

  it("right-click opens the menu; Pin calls onTogglePin", async () => {
    const onTogglePin = vi.fn();
    render(<SessionCard session={session} active={false} pinned={false} onSelect={noop} onTogglePin={onTogglePin} onRename={noop} />);
    fireEvent.contextMenu(screen.getByText("New chat"));
    await userEvent.click(screen.getByRole("menuitem", { name: /^pin$/i }));
    expect(onTogglePin).toHaveBeenCalledWith("web:abc");
  });

  it("shows Unpin in the menu when pinned", async () => {
    render(<SessionCard session={session} active={false} pinned={true} onSelect={noop} onTogglePin={noop} onRename={noop} />);
    await userEvent.click(screen.getByRole("button", { name: /agent options/i }));
    expect(screen.getByRole("menuitem", { name: /unpin/i })).toBeInTheDocument();
  });

  it("renders an avatar image when avatarUrl is set", () => {
    const { container } = render(
      <SessionCard session={session} active={false} pinned={false} avatarUrl="data:image/png;base64,XYZ" onSelect={noop} onTogglePin={noop} />,
    );
    const img = container.querySelector(".av img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.src).toContain("data:image/png;base64,XYZ");
  });

  it("menu offers Set avatar…, and picking a file calls onSetAvatar", async () => {
    const onSetAvatar = vi.fn();
    const { container } = render(
      <SessionCard session={session} active={false} pinned={false} onSelect={noop} onTogglePin={noop} onSetAvatar={onSetAvatar} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /agent options/i }));
    expect(screen.getByRole("menuitem", { name: /set avatar/i })).toBeInTheDocument();

    const file = new File(["x"], "a.png", { type: "image/png" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(onSetAvatar).toHaveBeenCalledWith("main", file);
  });

  it("Remove avatar shows only with an avatar set and calls onClearAvatar", async () => {
    const onClearAvatar = vi.fn();
    const { rerender } = render(
      <SessionCard session={session} active={false} pinned={false} onSelect={noop} onTogglePin={noop} onSetAvatar={noop} onClearAvatar={onClearAvatar} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /agent options/i }));
    expect(screen.queryByRole("menuitem", { name: /remove avatar/i })).toBeNull();

    // Menu stays open across the rerender; the item should now appear.
    rerender(
      <SessionCard session={session} active={false} pinned={false} avatarUrl="data:image/png;base64,XYZ" onSelect={noop} onTogglePin={noop} onSetAvatar={noop} onClearAvatar={onClearAvatar} />,
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /remove avatar/i }));
    expect(onClearAvatar).toHaveBeenCalledWith("main");
  });

  it("Escape cancels the rename without calling onRename", async () => {
    const onRename = vi.fn();
    render(<SessionCard session={session} active={false} pinned={false} onSelect={noop} onTogglePin={noop} onRename={onRename} />);
    await userEvent.click(screen.getByRole("button", { name: /agent options/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /rename/i }));
    const input = screen.getByRole("textbox", { name: /rename agent/i });
    await userEvent.clear(input);
    await userEvent.type(input, "Wolf{Escape}");
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText("New chat")).toBeInTheDocument();
  });
});
