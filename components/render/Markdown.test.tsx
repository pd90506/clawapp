import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders headings and inline code", () => {
    render(<Markdown md={"# Hello\n\nThis is `inline`."} />);
    expect(screen.getByRole("heading", { level: 1, name: "Hello" })).toBeInTheDocument();
    expect(screen.getByText("inline")).toBeInTheDocument();
  });
  it("renders GFM tables", () => {
    render(<Markdown md={"| a | b |\n|---|---|\n| 1 | 2 |"} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
  it("renders block math via KaTeX", () => {
    const { container } = render(<Markdown md={"$$x^2$$"} />);
    expect(container.querySelector(".katex")).not.toBeNull();
  });
  it("does not render raw HTML by default", () => {
    const { container } = render(<Markdown md={"<script>alert(1)</script>"} />);
    expect(container.querySelector("script")).toBeNull();
  });
});
