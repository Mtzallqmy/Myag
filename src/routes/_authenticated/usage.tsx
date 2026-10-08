import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUsage } from "@/lib/stage3.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/usage")({
  head: () => ({
    meta: [
      { title: "الاستخدام — وكيل" },
      { name: "description", content: "الطلبات والتوكنات والتكلفة التقديرية والحصص في وكيل." },
      { property: "og:title", content: "الاستخدام — وكيل" },
      { property: "og:description", content: "لوحة الاستخدام والحصص." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsagePage,
});

const fmt = (n: number, lang: string) => new Intl.NumberFormat(lang === "ar" ? "ar" : "en").format(Math.round(n));
const bytes = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${(n / 1e6).toFixed(1)} MB`);

function UsagePage() {
  const { t, lang } = useI18n();
  const [days, setDays] = useState(7);
  const fetchUsage = useServerFn(getUsage);
  const q = useQuery({ queryKey: ["usage", days], queryFn: () => fetchUsage({ data: { days } }) });
  const d = q.data;
  const sum = (k: "requests" | "input" | "output" | "cost") => (d?.days ?? []).reduce((n, r) => n + r[k], 0);
  const max = Math.max(1, ...(d?.days ?? []).map((r) => r.requests));

  return (
    <>
      <PageHeader title={t.usage.title} sub={d ? `${t.usage.plan}: ${d.tier}` : undefined} />
      <PageBody className="space-y-5">
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <TabsList>
            <TabsTrigger value="7" className="min-h-10">{t.usage.daily}</TabsTrigger>
            <TabsTrigger value="30" className="min-h-10">{t.usage.monthly}</TabsTrigger>
          </TabsList>
        </Tabs>
        {q.isLoading || !d ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                [t.usage.requests, fmt(sum("requests"), lang)],
                [t.usage.inputTokens, fmt(sum("input"), lang)],
                [t.usage.outputTokens, fmt(sum("output"), lang)],
                [t.usage.cost, sum("cost") > 0 ? `$${sum("cost").toFixed(4)}` : "—"],
                [t.usage.jobs, fmt(d.totals.jobs, lang)],
                [t.usage.storage, bytes(d.totals.storage)],
                [t.usage.providers, fmt(d.totals.providers, lang)],
                [t.usage.repositories, fmt(d.totals.repositories, lang)],
                [t.usage.mcp, fmt(d.totals.mcp, lang)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border bg-card p-4">
                  <div className="text-sm text-muted-foreground">{k}</div>
                  <div className="mt-1 font-mono text-xl font-semibold" dir="ltr">{v}</div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{t.usage.costNote}</p>
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 font-semibold">{t.usage.requests}</h2>
              {!d.days.length ? (
                <p className="text-muted-foreground">{t.usage.empty}</p>
              ) : (
                <ul className="space-y-1.5">
                  {d.days.map((r) => (
                    <li key={r.day} className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0 font-mono" dir="ltr">{r.day.slice(5)}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded bg-muted" aria-hidden>
                        <div className="h-full bg-primary" style={{ width: `${(r.requests / max) * 100}%` }} />
                      </div>
                      <span className="w-12 shrink-0 text-end font-mono" dir="ltr">{r.requests}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {d.providers.length > 0 && (
              <section className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 font-semibold">{t.usage.providers}</h2>
                <ul className="space-y-1 text-sm">{d.providers.map((p) => <li key={p.name} className="flex justify-between"><span>{p.name}</span><span className="font-mono">{p.requests}</span></li>)}</ul>
              </section>
            )}
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <h2 className="font-semibold">{t.usage.quotas}</h2>
              {d.quotas.map((x) => {
                const pct = Math.min(100, (x.used / Math.max(1, x.limit)) * 100);
                const show = (n: number) => (x.key === "storageBytes" ? bytes(n) : x.key === "providerSpendPerDayUsd" ? n.toFixed(2) : fmt(n, lang));
                return (
                  <div key={x.key}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{t.usage.q[x.key]}</span>
                      <span className="font-mono" dir="ltr">{show(x.used)} / {show(x.limit)}{pct >= 100 ? " ⚠" : ""}</span>
                    </div>
                    <Progress value={pct} aria-label={t.usage.q[x.key]} />
                  </div>
                );
              })}
            </section>
          </>
        )}
      </PageBody>
    </>
  );
}
