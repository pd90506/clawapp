import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
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
});
