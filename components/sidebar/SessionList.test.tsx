import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SessionList } from "./SessionList";

const NOW = new Date("2026-05-08T12:00:00Z").getTime();

describe("SessionList", () => {
  it("groups sessions by recency, with pinned first", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sessions: [
        { id: "web:1", title: "Today A" },
        { id: "web:2", title: "Yesterday B" },
        { id: "web:3", title: "Pinned C" },
      ]}), { status: 200 }),
    ));
    // The component derives `at` & agentId for now from constants; real backend hooks land in Task 14.
    render(<SessionList activeSessionId={null} pinnedIds={new Set(["web:3"])} onSelect={() => {}} onTogglePin={() => {}} now={NOW} />);
    await waitFor(() => expect(screen.getByText("Pinned C")).toBeInTheDocument());
    expect(screen.getAllByText(/Pinned/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Today A")).toBeInTheDocument();
  });

  it("hides empty group sections", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sessions: [{ id: "web:1", title: "Today A" }] }), { status: 200 }),
    ));
    render(<SessionList activeSessionId={null} pinnedIds={new Set()} onSelect={() => {}} onTogglePin={() => {}} now={NOW} />);
    await waitFor(() => expect(screen.getByText("Today A")).toBeInTheDocument());
    expect(screen.queryByText(/Pinned/i)).toBeNull();
  });
});
