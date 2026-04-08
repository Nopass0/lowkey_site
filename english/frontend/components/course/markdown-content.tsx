"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

interface Props {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: Props) {
  return (
    <div className={cn("mdx-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-white mt-8 mb-4 first:mt-0 pb-2 border-b border-white/10">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-white mt-6 mb-3 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-white/90 mt-5 mb-2 first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-white/75 leading-7 mb-4 last:mb-0 text-[15px]">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-white/80">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 space-y-1.5 pl-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 space-y-1.5 pl-0 list-none counter-reset-item">{children}</ol>
          ),
          li: ({ children, ordered, index }: any) => (
            <li className="flex items-start gap-2.5 text-white/75 text-[15px] leading-7">
              <span className="mt-[10px] w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
              <span>{children}</span>
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-4 pl-4 border-l-2 border-indigo-500/60 bg-indigo-500/5 py-3 pr-4 rounded-r-xl">
              <div className="text-white/70 italic text-sm leading-relaxed [&>p]:mb-0 [&>p]:text-sm [&>p]:text-white/70">
                {children}
              </div>
            </blockquote>
          ),
          code: ({ inline, className: cls, children }: any) => {
            if (inline) {
              return (
                <code className="px-1.5 py-0.5 rounded-md bg-white/10 text-indigo-300 font-mono text-[13px]">
                  {children}
                </code>
              );
            }
            return (
              <code className={cn("block", cls)}>{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-4 p-4 rounded-xl bg-white/5 border border-white/10 overflow-x-auto text-sm font-mono text-white/80 leading-6">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-5 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-white/5 border-b border-white/10">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-white/5">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-white/[0.02] transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-white/60 font-semibold text-xs uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-white/70">{children}</td>
          ),
          img: ({ src, alt }) => (
            <span className="block my-5">
              <img
                src={src}
                alt={alt || ""}
                className="rounded-xl max-w-full border border-white/10 shadow-lg"
                loading="lazy"
              />
              {alt && (
                <span className="block mt-2 text-center text-white/40 text-xs italic">
                  {alt}
                </span>
              )}
            </span>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
            >
              {children}
            </a>
          ),
          hr: () => (
            <hr className="my-6 border-white/10" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
