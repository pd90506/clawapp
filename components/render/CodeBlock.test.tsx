import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { CodeBlock } from "./CodeBlock";

describe("CodeBlock", () => {
  it("renders highlighted output for typescript", async () => {
    const { container } = render(<CodeBlock lang="ts" code={"const x: number = 1;"} />);
    await waitFor(() => {
      expect(container.querySelector("pre.shiki")).not.toBeNull();
    }, { timeout: 5000 });
  });
  it("falls back to plain code for unknown language", async () => {
    const { container } = render(<CodeBlock lang="zzz" code={"hello"} />);
    await waitFor(() => {
      // Either Shiki's pre.shiki or our fallback <code>
      const code = container.querySelector("pre.shiki, code");
      expect(code).not.toBeNull();
      expect(container.textContent).toContain("hello");
    }, { timeout: 5000 });
  });
  it("renders lang tag and copy button in codeblock-head", async () => {
    const { container } = render(<CodeBlock lang="ts" code={"const x = 1;"} />);
    const head = container.querySelector(".codeblock-head");
    expect(head).not.toBeNull();
    expect(container.querySelector(".codeblock-lang")?.textContent).toBe("ts");
    expect(container.querySelector(".codeblock-copy")).not.toBeNull();
  });
  it("copy button writes code to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    const code = "const x = 42;";
    const { container } = render(<CodeBlock lang="ts" code={code} />);
    const copyBtn = container.querySelector(".codeblock-copy") as HTMLElement;
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(code);
    });
  });
});
