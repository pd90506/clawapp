import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolCallPanel } from "./ToolCallPanel";

describe("ToolCallPanel", () => {
  it("shows pending state while not done", () => {
    render(<ToolCallPanel name="search" args={{ q: "x" }} done={false} />);
    expect(screen.getByText("search", { exact: false })).toBeInTheDocument();
    // status indicator shows running ellipsis
    expect(screen.getByText("…")).toBeInTheDocument();
  });
  it("shows ok status when done without error", () => {
    render(<ToolCallPanel name="search" args={{ q: "x" }} done={true} result="found" />);
    expect(screen.getByText("✓")).toBeInTheDocument();
  });
  it("shows err status when done with error", () => {
    render(<ToolCallPanel name="search" args={{ q: "x" }} done={true} error="timeout" />);
    expect(screen.getByText("✕")).toBeInTheDocument();
  });
  it("renders actor, verb, arg chips in the single tool row", () => {
    const { container } = render(
      <ToolCallPanel name="search" args={{ q: "hello" }} done={false} actor="OpenClaw" />,
    );
    expect(container.querySelector(".tool-actor")?.textContent).toBe("OpenClaw");
    expect(container.querySelector(".tool-verb")?.textContent).toBe("called search");
    // arg chip for the value "hello"
    const chips = container.querySelectorAll(".tool-arg");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0].textContent).toBe("hello");
  });
  it("clicking the row expands detail panel", async () => {
    const { container } = render(
      <ToolCallPanel name="search" args={{ q: "x" }} done={true} result="found" />,
    );
    expect(container.querySelector(".tool-detail")).toBeNull();
    const row = container.querySelector(".annot.tool") as HTMLElement;
    await userEvent.click(row);
    expect(container.querySelector(".tool-detail")).not.toBeNull();
  });
  it("all expected elements are direct children of .annot.tool", () => {
    const { container } = render(
      <ToolCallPanel name="search" args={{ q: "x" }} done={false} />,
    );
    const row = container.querySelector(".annot.tool") as HTMLElement;
    const directChildren = Array.from(row.children);
    const classNames = directChildren.map((el) => el.className);
    // caret, icon, actor, verb, args, status should all be direct children
    expect(classNames.some((c) => c.includes("tool-caret"))).toBe(true);
    expect(classNames.some((c) => c.includes("tool-icon"))).toBe(true);
    expect(classNames.some((c) => c.includes("tool-actor"))).toBe(true);
    expect(classNames.some((c) => c.includes("tool-verb"))).toBe(true);
    expect(classNames.some((c) => c.includes("tool-status"))).toBe(true);
  });
});
