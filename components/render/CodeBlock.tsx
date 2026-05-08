"use client";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

type Props = { lang: string; code: string };

export function CodeBlock({ lang, code }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, { lang, theme: "github-dark" })
      .then((h) => { if (!cancelled) setHtml(h); })
      .catch(() => { if (!cancelled) setHtml(null); });
    return () => { cancelled = true; };
  }, [code, lang]);

  if (html) return <div className="text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
  return (
    <pre className="rounded-md p-3 overflow-x-auto bg-zinc-900 text-zinc-100 text-sm">
      <code>{code}</code>
    </pre>
  );
}
