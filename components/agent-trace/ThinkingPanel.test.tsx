import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThinkingPanel } from "./ThinkingPanel";

describe("ThinkingPanel", () => {
  it('renders "Thinking…" cursor while not done and no detail', () => {
    render(<ThinkingPanel text="" done={false} />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
    // No button — just a plain annot
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("renders just label without button when detail is empty", () => {
    render(<ThinkingPanel text="hmm" done={true} detail={[]} />);
    expect(screen.getByText("Thoughts")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("renders chevron toggle when done with detail and reveals items on click", async () => {
    render(<ThinkingPanel text="" done={true} detail={["weighing options", "second thought"]} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeInTheDocument();
    // Items hidden initially
    expect(screen.queryByText("weighing options")).not.toBeInTheDocument();
    await userEvent.click(btn);
    expect(screen.getByText("weighing options")).toBeInTheDocument();
    expect(screen.getByText("second thought")).toBeInTheDocument();
  });
});
