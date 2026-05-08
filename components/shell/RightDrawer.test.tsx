import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RightDrawer } from "./RightDrawer";

describe("RightDrawer", () => {
  it("renders search input", () => {
    render(<RightDrawer onCollapse={() => {}} />);
    expect(screen.getByPlaceholderText(/search workspace/i)).toBeInTheDocument();
  });
  it("renders filter chips", () => {
    render(<RightDrawer onCollapse={() => {}} />);
    expect(screen.getByText(/filter/i)).toBeInTheDocument();
  });
  it("renders empty state message", () => {
    render(<RightDrawer onCollapse={() => {}} />);
    expect(screen.getByText(/no files yet/i)).toBeInTheDocument();
  });
  it("calls onCollapse when collapse button clicked", async () => {
    const onCollapse = vi.fn();
    render(<RightDrawer onCollapse={onCollapse} />);
    await userEvent.click(screen.getByRole("button", { name: /collapse desk/i }));
    expect(onCollapse).toHaveBeenCalled();
  });
});
