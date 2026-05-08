"use client";
import { useGatewayHealth } from "@/hooks/useGatewayHealth";

export function StatusBanner() {
  const state = useGatewayHealth();
  if (!state || state.ok) return null;
  return (
    <div role="alert" className="bg-red-600 text-white text-sm px-3 py-2">
      openclaw gateway unreachable{state.reason ? ` — ${state.reason}` : ""}
    </div>
  );
}
