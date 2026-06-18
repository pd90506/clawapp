import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarHeader } from "./SidebarHeader";

describe("SidebarHeader", () => {
  it("renders the title and a collapse control only (no add/settings)", () => {
    render(<SidebarHeader onCollapse={() => {}} />);
    expect(screen.getByText("Chats")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new chat/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /settings/i })).toBeNull();
  });

  it("calls onCollapse when the collapse control is clicked", async () => {
    const onCollapse = vi.fn();
    render(<SidebarHeader onCollapse={onCollapse} />);
    await userEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    expect(onCollapse).toHaveBeenCalled();
  });
});
