import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HISTORY_SECTIONS, historyQuery, type HistoryRow, type HistorySection } from "@/lib/queries3";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "السجل — وكيل" },
      { name: "description", content: "سجل موحّد للمحادثات والمهام وGitHub وMCP والموافقات والتعديلات." },
      { property: "og:title", content: "السجل — وكيل" },
      { property: "og:description", content: "كل نشاطك في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

function Row({ r, lang }: { r: HistoryRow; lang: string }) {
  const body = (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{r.title}</div>
        <div className="text-sm text-muted-foreground">{new Date(r.at).toLocaleString(lang)}</div>
      </div>
      {r.status && <span className="shrink-0 rounded-md border border-border px-2 py-0.5 font-mono text-xs" dir="ltr">{r.status}</span>}
    </div>
  );
  return r.href ? (
    <Link to={r.href.to} params={{ id: r.href.id }} className="block">{body}</Link>
  ) : (
    body
  );
}

function HistoryPage() {
  const { t, lang } = useI18n();
  const [section, setSection] = useState<HistorySection>("conversations");
  const q = useQuery(historyQuery(section));
  return (
    <>
      <PageHeader title={t.history.title} />
      <PageBody className="space-y-4">
        <Tabs value={section} onValueChange={(v) => setSection(v as HistorySection)}>
          <TabsList className="h-auto w-full flex-wrap justify-start">
            {HISTORY_SECTIONS.map((s) => (
              <TabsTrigger key={s} value={s} className="min-h-10">{t.history[s]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {q.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !q.data?.length ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">{t.history.empty}</div>
        ) : (
          <ul className="space-y-2">{q.data.map((r) => <li key={r.id}><Row r={r} lang={lang} /></li>)}</ul>
        )}
      </PageBody>
    </>
  );
}
