import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { EmptyHero } from "./EmptyHero";

describe("EmptyHero", () => {
  it("renders the prompt and an agent picker", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ agents: [{ id: "main", label: "Main" }] }), { status: 200 }),
    ));
    render(<EmptyHero selectedAgent="main" onSelectAgent={() => {}} />);
    expect(screen.getByText(/What are we chatting about/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Main")).toBeInTheDocument());
  });
});
