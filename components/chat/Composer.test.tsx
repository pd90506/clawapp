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

const MOCK_COMMANDS = [
  { name: "plan", description: "Break task into steps", source: "native" },
  { name: "explain", description: "Explain selected code", source: "native" },
  { name: "web", description: "Search the web", source: "skill" },
];

function setupFetch(models = MOCK_MODELS, commands = MOCK_COMMANDS) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    const body = typeof url === "string" && url.startsWith("/api/commands") ? { commands } : { models };
    return Promise.resolve({ json: async () => body } as Response);
  });
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

  it("typing / opens the command/skill autocomplete", async () => {
    render(<Composer onSend={() => {}} disabled={false} />);
    expect(screen.queryByText("/plan")).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "/");
    expect(await screen.findByText("/plan")).toBeInTheDocument();
    expect(screen.getByText("/explain")).toBeInTheDocument();
  });

  it("filters the list as you type the command name", async () => {
    render(<Composer onSend={() => {}} disabled={false} />);
    await userEvent.type(screen.getByRole("textbox"), "/ex");
    expect(await screen.findByText("/explain")).toBeInTheDocument();
    expect(screen.queryByText("/plan")).not.toBeInTheDocument();
  });

  it("clicking a command inserts /<name> into the textarea", async () => {
    render(<Composer onSend={() => {}} disabled={false} />);
    await userEvent.type(screen.getByRole("textbox"), "/");
    await userEvent.click(await screen.findByRole("menuitem", { name: /\/plan/i }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("/plan ");
  });

  it("Enter accepts the highlighted command instead of sending", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} disabled={false} />);
    await userEvent.type(screen.getByRole("textbox"), "/ex");
    expect(await screen.findByText("/explain")).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    expect(onSend).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("/explain ");
  });

  it("Escape dismisses the autocomplete", async () => {
    render(<Composer onSend={() => {}} disabled={false} />);
    await userEvent.type(screen.getByRole("textbox"), "/");
    expect(await screen.findByText("/plan")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
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
