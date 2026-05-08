import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarHeader } from "./SidebarHeader";

describe("SidebarHeader", () => {
  it("calls onNewChat when + clicked", async () => {
    const onNewChat = vi.fn();
    render(<SidebarHeader onNewChat={onNewChat} onCollapse={() => {}} disabled={false} />);
    await userEvent.click(screen.getByRole("button", { name: /new chat/i }));
    expect(onNewChat).toHaveBeenCalled();
  });
  it("disables new chat when disabled prop is true", () => {
    render(<SidebarHeader onNewChat={() => {}} onCollapse={() => {}} disabled={true} />);
    expect(screen.getByRole("button", { name: /new chat/i })).toBeDisabled();
  });
});
