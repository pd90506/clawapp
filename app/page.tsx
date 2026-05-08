import { redirect } from "next/navigation";
import { getClient } from "@/lib/openclaw";
import { AppShell } from "@/components/shell/AppShell";

export default async function Page() {
  const c = getClient();
  if (!c) redirect("/setup");
  return <AppShell />;
}
