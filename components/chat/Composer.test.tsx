import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "./Composer";

describe("Composer", () => {
  it("submits on click", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} disabled={false} />);
    await userEvent.type(screen.getByRole("textbox"), "hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith("hello");
  });
  it("submits on Enter", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} disabled={false} />);
    const ta = screen.getByRole("textbox");
    await userEvent.type(ta, "hi");
    await userEvent.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledWith("hi");
  });
  it("inserts a newline on Shift-Enter (does not submit)", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} disabled={false} />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    await userEvent.type(ta, "line1");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await userEvent.type(ta, "line2");
    expect(onSend).not.toHaveBeenCalled();
    expect(ta.value).toBe("line1\nline2");
  });
  it("Cmd/Ctrl-Enter still submits (alias)", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} disabled={false} />);
    await userEvent.type(screen.getByRole("textbox"), "hi");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(onSend).toHaveBeenCalledWith("hi");
  });
  it("is disabled when prop is true", () => {
    render(<Composer onSend={() => {}} disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });
});
