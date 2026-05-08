"use client";
import type { ReactNode } from "react";

export function SessionGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="px-3 pb-1 text-xs uppercase tracking-wider text-[var(--text-faint)]">{title}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
