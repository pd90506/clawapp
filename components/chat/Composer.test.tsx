import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer, modelDisplayName } from "./Composer";

describe("modelDisplayName", () => {
  it("keeps a genuine alias (alias ≠ provider)", () => {
    expect(modelDisplayName({ id: "claude-opus-4-8", label: "opus", provider: "anthropic" })).toBe("opus");
  });
  it("falls back to the id when the label is just the provider/brand", () => {
    expect(modelDisplayName({ id: "deepseek-v4-flash", label: "DeepSeek", provider: "deepseek" })).toBe("deepseek-v4-flash");
  });
  it("uses the id when there is no label", () => {
    expect(modelDisplayName({ id: "deepseek-v4-pro", label: "", provider: "deepseek" })).toBe("deepseek-v4-pro");
  });
});

const MOCK_MODELS = [
  { id: "kimi/kimi-code", label: "Kimi", isDefault: true },
  { id: "gpt-5.5", label: "GPT 5.5", isDefault: false },
];

function setupFetch(models = MOCK_MODELS) {
  global.fetch = vi.fn().mockResolvedValue({
    json: async () => ({ models }),
  } as Response);
}

beforeEach(() => setupFetch());
afterEach(() => vi.restoreAllMocks());

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

  it("clicking / button shows the slash commands popup", async () => {
    render(<Composer onSend={() => {}} disabled={false} />);
    // Popup not shown initially
    expect(screen.queryByText("/plan")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTitle("Slash command"));
    expect(screen.getByText("/plan")).toBeInTheDocument();
    expect(screen.getByText("/explain")).toBeInTheDocument();
  });

  it("clicking a slash command inserts /<cmd> into the textarea", async () => {
    render(<Composer onSend={() => {}} disabled={false} />);
    await userEvent.click(screen.getByTitle("Slash command"));
    await userEvent.click(screen.getByRole("menuitem", { name: /\/plan/i }));
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(ta.value).toBe("/plan ");
  });

  it("clicking outside the popup closes it", async () => {
    render(<Composer onSend={() => {}} disabled={false} />);
    await userEvent.click(screen.getByTitle("Slash command"));
    expect(screen.getByText("/plan")).toBeInTheDocument();
    // Click outside (on the body)
    await userEvent.click(document.body);
    expect(screen.queryByText("/plan")).not.toBeInTheDocument();
  });
});

describe("Composer — model selector", () => {
  it("renders model menu button after /api/models fetch resolves", async () => {
    render(<Composer onSend={() => {}} disabled={false} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /model selector/i })).toBeInTheDocument()
    );
  });

  it("shows 'Default (Kimi)' when the current model is the default", async () => {
    render(<Composer onSend={() => {}} disabled={false} />);
    await waitFor(() => expect(screen.getByText("Default")).toBeInTheDocument());
    expect(screen.getByText("(Kimi)")).toBeInTheDocument();
  });

  it("shows plain label when current model is not the default", async () => {
    // Pre-seed localStorage so GPT 5.5 (non-default) is selected
    localStorage.setItem("clawapp.model", "gpt-5.5");
    render(<Composer onSend={() => {}} disabled={false} />);
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /model selector/i });
      expect(btn.textContent).toContain("GPT 5.5");
      expect(btn.textContent).not.toContain("Default");
    });
    localStorage.removeItem("clawapp.model");
  });

  it("clicking a model item updates the displayed label", async () => {
    render(<Composer onSend={() => {}} disabled={false} />);
    // Wait for models to load
    await waitFor(() => screen.getByRole("button", { name: /model selector/i }));
    // Open the model menu
    await userEvent.click(screen.getByRole("button", { name: /model selector/i }));
    // Click on GPT 5.5
    await userEvent.click(screen.getByRole("menuitem", { name: /GPT 5.5/i }));
    // Menu should close and button should now show plain label
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /model selector/i });
      expect(btn.textContent).toContain("GPT 5.5");
      expect(btn.textContent).not.toContain("Default");
    });
    localStorage.removeItem("clawapp.model");
  });

  it("falls back to Default model when fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));
    render(<Composer onSend={() => {}} disabled={false} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /model selector/i })).toBeInTheDocument());
    const btn = screen.getByRole("button", { name: /model selector/i });
    expect(btn.textContent).toContain("Default");
  });
});
