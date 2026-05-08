"use client";
import type { ReactNode } from "react";

export function SessionGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="rail-section">{title}</div>
      {children}
    </div>
  );
}
