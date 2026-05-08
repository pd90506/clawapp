"use client";
import { useEffect, useState } from "react";

export type Tab = "chat" | "channels";

function readUrl(): Tab {
  if (typeof window === "undefined") return "chat";
  const t = new URLSearchParams(window.location.search).get("tab");
  return t === "channels" ? "channels" : "chat";
}

export function useActiveTab() {
  // Avoid SSR/CSR mismatch: start with "chat" default, hydrate from URL after mount.
  const [tab, setTab] = useState<Tab>("chat");

  useEffect(() => {
    const next = readUrl();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next !== "chat") setTab(next);
    const onPop = () => setTab(readUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setTabUrl = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "chat") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  return { tab, setTab: setTabUrl };
}
