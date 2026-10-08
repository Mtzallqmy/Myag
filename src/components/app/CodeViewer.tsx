import { useMemo } from "react";
import hljs from "highlight.js/lib/common";

const LANG_MAP: Record<string, string> = {
  TypeScript: "typescript", JavaScript: "javascript", Python: "python", Go: "go", Rust: "rust", Java: "java", Kotlin: "kotlin",
  Swift: "swift", Ruby: "ruby", PHP: "php", "C#": "csharp", "C++": "cpp", C: "c", SQL: "sql", Shell: "bash", HTML: "xml",
  XML: "xml", CSS: "css", SCSS: "scss", Less: "less", Markdown: "markdown", JSON: "json", YAML: "yaml", TOML: "ini", Dart: "dart",
  Lua: "lua", R: "r", Scala: "scala", GraphQL: "graphql", Dockerfile: "dockerfile",
};

/** LTR source viewer with line numbers and syntax highlighting (hljs escapes HTML). */
export function CodeViewer({ code, language, highlightLine }: { code: string; language: string | null; highlightLine?: number | null }) {
  const html = useMemo(() => {
    const lang = language ? LANG_MAP[language] : undefined;
    if (code.length > 300_000) return null;
    try {
      return lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : hljs.highlightAuto(code).value;
    } catch {
      return null;
    }
  }, [code, language]);
  const lines = code.split("\n").length;
  return (
    <div className="hljs-theme overflow-hidden rounded-lg border border-border bg-code text-code-foreground" dir="ltr">
      <div className="flex overflow-x-auto text-[13px] leading-[1.6]">
        <pre aria-hidden className="sticky left-0 select-none border-r border-white/10 bg-code px-3 py-3 text-right font-mono opacity-50">
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className={highlightLine === i + 1 ? "text-warning opacity-100" : ""}>
              {i + 1}
            </div>
          ))}
        </pre>
        {html !== null ? (
          <pre className="flex-1 px-4 py-3 font-mono" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="flex-1 px-4 py-3 font-mono">{code}</pre>
        )}
      </div>
    </div>
  );
}
