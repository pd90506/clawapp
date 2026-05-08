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
  it("falls back to plain pre for unknown language", async () => {
    const { container } = render(<CodeBlock lang="zzz" code={"hello"} />);
    await waitFor(() => {
      expect(container.querySelector("pre")).not.toBeNull();
    }, { timeout: 5000 });
  });
});
