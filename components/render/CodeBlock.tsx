"use client";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import DOMPurify from "isomorphic-dompurify";

type Props = { lang: string; code: string };

export function CodeBlock({ lang, code }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, {
      lang,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: "light",
    })
      .then((h) => {
        const safe = DOMPurify.sanitize(h, { USE_PROFILES: { html: true } });
        if (!cancelled) setHtml(safe);
      })
      .catch(() => { if (!cancelled) setHtml(null); });
    return () => { cancelled = true; };
  }, [code, lang]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* ignore */ }
  };

  return (
    <div className="codeblock">
      <div className="codeblock-head">
        <span className="codeblock-lang">{lang || "text"}</span>
        <button type="button" className="codeblock-copy" onClick={onCopy}>
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      {html ? (
        <div className="codeblock-body" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre><code>{code}</code></pre>
      )}
    </div>
  );
}
