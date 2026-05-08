"use client";

export function SidebarNavRows() {
  return (
    <div className="px-3 py-2 flex flex-col gap-0.5 border-b border-[var(--border-soft)]">
      <NavRow icon="🔗" label="Connect channels" />
      <NavRow icon="⚡" label="Activity" />
      <NavRow icon="⏱" label="Tasks" />
    </div>
  );
}

function NavRow({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Coming in v1.3"
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-[var(--text-muted)] opacity-70 cursor-not-allowed"
    >
      <span className="w-5 text-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
