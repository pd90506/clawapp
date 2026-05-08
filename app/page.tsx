import { redirect } from "next/navigation";
import { getClient } from "@/lib/openclaw";
import { ChatPage } from "./ChatPage";

export default async function Page() {
  const c = getClient();
  if (!c) redirect("/setup");
  const sessions = await c.listSessions().catch(() => []);
  const initial = sessions[0];
  return <ChatPage initialSessionId={initial?.id ?? null} sessions={sessions} />;
}
