import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentPicker } from "./AgentPicker";

beforeEach(() => { vi.unstubAllGlobals(); });

describe("AgentPicker", () => {
  it("renders chips fetched from /api/agents", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ agents: [{ id: "main", label: "Main" }, { id: "alpha", label: "Alpha" }] }), { status: 200 }),
    ));
    render(<AgentPicker selected="main" onSelect={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("Main")).toBeInTheDocument();
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });
  });

  it("clicking a chip fires onSelect", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ agents: [{ id: "main", label: "Main" }, { id: "alpha", label: "Alpha" }] }), { status: 200 }),
    ));
    const onSelect = vi.fn();
    render(<AgentPicker selected="main" onSelect={onSelect} />);
    await waitFor(() => screen.getByText("Alpha"));
    await userEvent.click(screen.getByText("Alpha"));
    expect(onSelect).toHaveBeenCalledWith("alpha");
  });

  it("falls back to a Default chip on fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    render(<AgentPicker selected="main" onSelect={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("Default")).toBeInTheDocument();
    });
  });
});
