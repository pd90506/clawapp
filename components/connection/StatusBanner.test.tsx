import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StatusBanner } from "./StatusBanner";

describe("StatusBanner", () => {
  it("hides when healthy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    render(<StatusBanner />);
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
  it("shows banner when unhealthy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, reason: "x" }), { status: 503 })));
    render(<StatusBanner />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
