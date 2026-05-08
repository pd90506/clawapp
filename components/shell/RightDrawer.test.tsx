import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RightDrawer } from "./RightDrawer";

describe("RightDrawer", () => {
  it("renders Desk and Note section headers", () => {
    render(<RightDrawer onCollapse={() => {}} />);
    expect(screen.getByText("Desk")).toBeInTheDocument();
    expect(screen.getByText("Note")).toBeInTheDocument();
  });
  it("calls onCollapse when collapse button clicked", async () => {
    const onCollapse = vi.fn();
    render(<RightDrawer onCollapse={onCollapse} />);
    await userEvent.click(screen.getByRole("button", { name: /collapse desk/i }));
    expect(onCollapse).toHaveBeenCalled();
  });
});
