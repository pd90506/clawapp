import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionList } from "./SessionList";

const NOW = new Date("2026-05-08T12:00:00Z").getTime();

beforeEach(() => window.localStorage.clear());

// Mock fetch: GET /api/agents returns the roster; GET /api/sessions returns app
// sessions (with updatedAt); POST /api/sessions/resolve echoes the namespaced key.
function mockFetch(agents: { id: string; label?: string }[], sessions: { id: string; updatedAt?: number }[] = []) {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/agents")) {
      return new Response(JSON.stringify({ agents }), { status: 200 });
    }
    if (u.includes("/api/sessions/resolve")) {
      const { agentId } = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify({ id: `agent:${agentId}:app:${agentId}`, title: agentId }), { status: 200 });
    }
    if (u.includes("/api/sessions")) {
      return new Response(JSON.stringify({ sessions }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  });
}

describe("SessionList", () => {
  const titles = (c: HTMLElement) => [...c.querySelectorAll(".convo-title")].map((n) => n.textContent);

  it("renders one row per agent, titled by agent id (no nickname set)", async () => {
    vi.stubGlobal("fetch", mockFetch([{ id: "silver-wolf" }, { id: "main" }]));
    const { container } = render(<SessionList activeSessionId={null} pinnedIds={new Set()} onSelect={() => {}} onTogglePin={() => {}} now={NOW} />);
    await waitFor(() => expect(titles(container)).toEqual(["silver-wolf", "main"]));
    // Agent id also appears as the subtitle (.convo-meta).
    expect([...container.querySelectorAll(".convo-meta")].map((n) => n.textContent)).toEqual(["silver-wolf", "main"]);
  });

  it("selecting an agent resolves to its app-owned session", async () => {
    vi.stubGlobal("fetch", mockFetch([{ id: "silver-wolf" }]));
    const onSelect = vi.fn();
    const { container } = render(<SessionList activeSessionId={null} pinnedIds={new Set()} onSelect={onSelect} onTogglePin={() => {}} now={NOW} />);
    await waitFor(() => expect(container.querySelector(".convo-title")).not.toBeNull());
    await userEvent.click(container.querySelector(".convo-title")!);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("agent:silver-wolf:app:silver-wolf"));
  });

  it("highlights the active agent by agent id, not raw key", async () => {
    vi.stubGlobal("fetch", mockFetch([{ id: "silver-wolf" }, { id: "main" }]));
    const { container } = render(
      <SessionList activeSessionId="agent:silver-wolf:app:silver-wolf" pinnedIds={new Set()} onSelect={() => {}} onTogglePin={() => {}} now={NOW} />,
    );
    await waitFor(() => expect(container.querySelector(".convo")).not.toBeNull());
    const active = [...container.querySelectorAll(".convo.active .convo-title")].map((n) => n.textContent);
    expect(active).toEqual(["silver-wolf"]);
  });

  it("orders pinned agents first", async () => {
    vi.stubGlobal("fetch", mockFetch([{ id: "silver-wolf" }, { id: "main" }]));
    // Pin main (its canonical app session key); it should render before silver-wolf.
    const { container } = render(<SessionList activeSessionId={null} pinnedIds={new Set(["agent:main:app:main"])} onSelect={() => {}} onTogglePin={() => {}} now={NOW} />);
    await waitFor(() => expect(titles(container)).toEqual(["main", "silver-wolf"]));
  });

  it("shows the unread dot only for an agent whose app session advanced past the last read", async () => {
    // silver-wolf advanced past its read marker (unread); main's read marker is ahead (read).
    window.localStorage.setItem("clawapp.agentReads", JSON.stringify({ "silver-wolf": 1000, main: 9_999_999_999 }));
    vi.stubGlobal("fetch", mockFetch(
      [{ id: "silver-wolf" }, { id: "main" }],
      [
        { id: "agent:silver-wolf:app:silver-wolf", updatedAt: 2000 },
        { id: "agent:main:app:main", updatedAt: 5000 },
      ],
    ));
    const { container } = render(<SessionList activeSessionId={null} pinnedIds={new Set()} onSelect={() => {}} onTogglePin={() => {}} now={NOW} />);
    await waitFor(() => expect(container.querySelectorAll('[aria-label="unread messages"]').length).toBe(1));
    const rowsEls = [...container.querySelectorAll(".convo")];
    const row = (name: string) => rowsEls.find((r) => r.querySelector(".convo-title")?.textContent === name)!;
    expect(row("silver-wolf").querySelector('[aria-label="unread messages"]')).not.toBeNull();
    expect(row("main").querySelector('[aria-label="unread messages"]')).toBeNull();
  });
});
