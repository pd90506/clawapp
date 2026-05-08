export default function SetupPage() {
  return (
    <div className="max-w-xl mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-semibold">clawapp setup</h1>
      <p>The app could not find your openclaw gateway configuration.</p>
      <ol className="list-decimal list-inside space-y-2 text-sm">
        <li>Make sure openclaw is installed at <code>~/.openclaw/</code> and has run at least once.</li>
        <li>Confirm <code>~/.openclaw/openclaw.json</code> is readable and contains <code>gateway.port</code> and <code>gateway.auth.token</code>.</li>
        <li>Or set the env vars <code>OPENCLAW_GATEWAY_URL</code> and <code>OPENCLAW_TOKEN</code> and restart the app.</li>
      </ol>
      <p className="text-sm text-zinc-500">Then refresh this page.</p>
    </div>
  );
}
