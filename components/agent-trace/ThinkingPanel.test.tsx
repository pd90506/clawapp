import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThinkingPanel } from "./ThinkingPanel";

describe("ThinkingPanel", () => {
  it('says "Thinking…" while not done', () => {
    render(<ThinkingPanel text="hmm" done={false} />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });
  it("reveals text when expanded", async () => {
    render(<ThinkingPanel text="weighing options" done={true} />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("weighing options")).toBeInTheDocument();
  });
});
