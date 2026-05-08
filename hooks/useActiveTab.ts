"use client";
import { useEffect, useState } from "react";

export type Tab = "chat" | "channels";

function read(): Tab {
  if (typeof window === "undefined") return "chat";
  const t = new URLSearchParams(window.location.search).get("tab");
  return t === "channels" ? "channels" : "chat";
}

export function useActiveTab() {
  const [tab, setTab] = useState<Tab>(() => read());

  useEffect(() => {
    const onPop = () => setTab(read());
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
