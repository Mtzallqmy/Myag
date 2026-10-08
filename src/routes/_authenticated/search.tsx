import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { globalSearch } from "@/lib/stage3.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: "البحث — وكيل" },
      { name: "description", content: "ابحث في محادثاتك ومشاريعك وملفاتك ومهامك ومستودعاتك." },
      { property: "og:title", content: "البحث — وكيل" },
      { property: "og:description", content: "بحث شامل في بياناتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SearchPage,
});

function Group({ title, children, count }: { title: string; children: ReactNode; count: number }) {
  if (!count) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{children}</ul>
    </section>
  );
}
const item = "block px-4 py-3 hover:bg-muted";

function SearchPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const run = useServerFn(globalSearch);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  const res = useQuery({ queryKey: ["search", debounced], queryFn: () => run({ data: { q: debounced } }), enabled: debounced.length >= 2 });
  const d = res.data;
  const total = d ? d.conversations.length + d.projects.length + d.files.length + d.jobs.length + d.repositories.length + d.integrations.length : 0;

  return (
    <>
      <PageHeader title={t.search.title} />
      <PageBody className="space-y-5">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search.placeholder} aria-label={t.search.placeholder} className="h-12 ps-10 text-base" />
        </div>
        {debounced.length < 2 ? (
          <p className="text-muted-foreground">{t.search.min}</p>
        ) : res.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !total ? (
          <p className="text-muted-foreground">{t.search.none}</p>
        ) : d ? (
          <>
            <Group title={t.search.conversations} count={d.conversations.length}>
              {d.conversations.map((c: any) => <li key={c.id}><Link to="/chats/$id" params={{ id: c.id }} className={item}>{c.title}</Link></li>)}
            </Group>
            <Group title={t.search.projects} count={d.projects.length}>
              {d.projects.map((p: any) => <li key={p.id}><Link to="/projects/$id" params={{ id: p.id }} className={item}>{p.name}</Link></li>)}
            </Group>
            <Group title={t.search.files} count={d.files.length}>
              {d.files.map((f: any) => <li key={f.project_id + f.path}><Link to="/projects/$id" params={{ id: f.project_id }} className={`${item} font-mono text-sm`} dir="ltr">{f.path}</Link></li>)}
            </Group>
            <Group title={t.search.jobs} count={d.jobs.length}>
              {d.jobs.map((j: any) => <li key={j.id}><Link to="/tasks/$id" params={{ id: j.id }} className={`${item} truncate`}>{j.request_text}</Link></li>)}
            </Group>
            <Group title={t.search.repositories} count={d.repositories.length}>
              {d.repositories.map((r: any) => <li key={r.id}><Link to="/github" className={`${item} font-mono text-sm`} dir="ltr">{r.full_name}</Link></li>)}
            </Group>
            <Group title={t.search.integrations} count={d.integrations.length}>
              {d.integrations.map((i: any) => <li key={i.id}><Link to={i.kind === "mcp" ? "/integrations" : "/providers"} className={item}>{i.name}</Link></li>)}
            </Group>
          </>
        ) : null}
      </PageBody>
    </>
  );
}
