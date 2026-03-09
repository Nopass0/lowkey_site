"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AiMarkdownProps {
  content: string;
}

export function AiMarkdown({ content }: AiMarkdownProps) {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none prose-pre:bg-zinc-950 prose-pre:text-zinc-50 prose-pre:rounded-2xl prose-table:block prose-table:overflow-x-auto prose-table:w-full prose-th:text-left prose-td:align-top prose-img:rounded-2xl prose-img:border prose-img:border-border">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="min-w-full text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-muted/70 px-4 py-3 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-t border-border/50 px-4 py-3 align-top">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-4"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const inline = !className;
            return inline ? (
              <code className="rounded bg-muted px-1.5 py-0.5 text-[0.9em]">
                {children}
              </code>
            ) : (
              <code className={className}>{children}</code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
