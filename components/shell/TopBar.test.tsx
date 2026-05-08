import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopBar } from "./TopBar";

describe("TopBar", () => {
  it("renders Chat and Channels tabs and highlights active", () => {
    render(<TopBar tab="chat" onTabChange={() => {}} leftOpen={true} rightOpen={true} onToggleLeft={() => {}} onToggleRight={() => {}} />);
    expect(screen.getByRole("button", { name: /^chat$/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: /^channels$/i })).toHaveAttribute("aria-selected", "false");
  });
  it("calls onTabChange when a tab is clicked", async () => {
    const onTabChange = vi.fn();
    render(<TopBar tab="chat" onTabChange={onTabChange} leftOpen={true} rightOpen={true} onToggleLeft={() => {}} onToggleRight={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /channels/i }));
    expect(onTabChange).toHaveBeenCalledWith("channels");
  });
  it("calls onToggleLeft when left toggle clicked", async () => {
    const onToggleLeft = vi.fn();
    render(<TopBar tab="chat" onTabChange={() => {}} leftOpen={true} rightOpen={true} onToggleLeft={onToggleLeft} onToggleRight={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /toggle left/i }));
    expect(onToggleLeft).toHaveBeenCalled();
  });
});
