"use client";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

type Props = { md: string };

function MarkdownInner({ md }: Props) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          img: (props) => (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img {...props} loading="lazy" referrerPolicy="no-referrer" className="max-w-full rounded" />
          ),
          code({ className, children, ...rest }) {
            const text = String(children).replace(/\n$/, "");
            const isBlock = /language-/.test(className ?? "");
            if (!isBlock) return <code className={className} {...rest}>{text}</code>;
            return (
              <pre className="rounded-md p-3 overflow-x-auto bg-zinc-900 text-zinc-100 text-sm">
                <code className={className}>{text}</code>
              </pre>
            );
          },
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownInner);
