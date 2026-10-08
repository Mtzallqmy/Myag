import { memo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/lib/i18n";

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-code text-code-foreground" dir="ltr">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-xs">
        <span className="font-mono opacity-70">{lang || "text"}</span>
        <button
          className="flex items-center gap-1 rounded px-1.5 py-0.5 opacity-80 hover:opacity-100"
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? t.common.copied : t.common.copy}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-chat" dir="auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }: { children?: ReactNode | undefined }) => <>{children}</>,
          code: ({ className, children }: { className?: string | undefined; children?: ReactNode | undefined }) => {
            const match = /language-([\w+-]+)/.exec(className ?? "");
            const content = String(children ?? "");
            const isBlock = !!match || content.includes("\n");
            if (!isBlock) return <code>{children}</code>;
            return <CodeBlock lang={match?.[1] ?? ""} code={content.replace(/\n$/, "")} />;
          },
          a: ({ href, children }: { href?: string | undefined; children?: ReactNode | undefined }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
