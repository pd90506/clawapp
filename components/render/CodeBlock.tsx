"use client";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import DOMPurify from "isomorphic-dompurify";

type Props = { lang: string; code: string };

export function CodeBlock({ lang, code }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, {
      lang,
      // Dual-theme output uses CSS variables that follow prefers-color-scheme.
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

  if (html) {
    // The Shiki output is its own <pre.shiki>; .md-content pre styles wrap it.
    // Wrap in a div so we don't double-stack pre elements when ReactMarkdown
    // already supplies an outer <pre>.
    return <div className="md-shiki" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  // Fallback before Shiki resolves: plain text inside the .md-content pre frame
  return <code>{code}</code>;
}
