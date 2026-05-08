import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolCallPanel } from "./ToolCallPanel";

describe("ToolCallPanel", () => {
  it("shows pending state while not done", () => {
    render(<ToolCallPanel name="search" args={{ q: "x" }} done={false} />);
    expect(screen.getByText(/search/)).toBeInTheDocument();
    expect(screen.getByText(/running/i)).toBeInTheDocument();
  });
  it("expands to show args + result when toggled", async () => {
    render(<ToolCallPanel name="search" args={{ q: "x" }} done={true} result="found" />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/"q": "x"/)).toBeInTheDocument();
    expect(screen.getByText("found")).toBeInTheDocument();
  });
});
