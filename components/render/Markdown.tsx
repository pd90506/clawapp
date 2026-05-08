"use client";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { CodeBlock } from "./CodeBlock";

type Props = { md: string };

function MarkdownInner({ md }: Props) {
  return (
    <div className="md-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          img: (props) => (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img {...props} loading="lazy" referrerPolicy="no-referrer" className="max-w-full rounded" />
          ),
          // Suppress the outer <pre> for fenced blocks — CodeBlock renders its
          // own <pre class="shiki">. For non-fenced uses (rare), keep the pre.
          pre: ({ children }) => <>{children}</>,
          code({ className, children, ...rest }) {
            const text = String(children).replace(/\n$/, "");
            const m = /language-(\w+)/.exec(className ?? "");
            if (!m) return <code className={className} {...rest}>{text}</code>;
            return <CodeBlock lang={m[1]} code={text} />;
          },
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownInner);
