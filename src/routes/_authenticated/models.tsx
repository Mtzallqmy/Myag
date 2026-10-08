import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Star, Zap } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { Chip, StatusChip } from "@/components/app/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { testModel } from "@/lib/providers.functions";
import { capsOf, latencyOf, matchesFilter, MODEL_FILTERS, type ModelFilter } from "@/lib/ai/models";
import { CAPABILITIES } from "@/lib/ai/types";
import { modelsQuery, providersQuery, qk, routingQuery, type Model } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/models")({
  head: () => ({
    meta: [
      { title: "النماذج — وكيل" },
      { name: "description", content: "النماذج المكتشفة من مزوداتك مع الفلاتر والقدرات والأسعار." },
      { property: "og:title", content: "النماذج — وكيل" },
      { property: "og:description", content: "استعرض واختبر نماذج الذكاء الاصطناعي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModelsPage,
});

const PAGE_SIZE = 25;
const FILTER_ORDER: ModelFilter[] = ["free", "working", "tools", "vision", "reasoning", "coding", "fast", "long", "all"];

function ModelsPage() {
  const { t, errorText } = useI18n();
  const qc = useQueryClient();
  const models = useQuery(modelsQuery);
  const providers = useQuery(providersQuery);
  const routing = useQuery(routingQuery);
  const [filter, setFilter] = useState<ModelFilter>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [testing, setTesting] = useState<string | null>(null);
  const runTest = useServerFn(testModel);

  const providerName = useMemo(() => new Map((providers.data ?? []).map((p) => [p.id, p.name])), [providers.data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (models.data ?? []).filter(
      (m) =>
        m.is_available &&
        matchesFilter(m, filter) &&
        (!needle || m.display_name.toLowerCase().includes(needle) || m.external_model_id.toLowerCase().includes(needle)),
    );
  }, [models.data, filter, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const slice = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  async function test(m: Model) {
    setTesting(m.id);
    const r = await runTest({ data: { modelId: m.id } }).catch(() => ({ ok: false as const, error: "UNEXPECTED" }));
    setTesting(null);
    qc.invalidateQueries({ queryKey: qk.models });
    if (!r.ok) { toast.error(errorText(r.error)); return; }
    if (r.data.status === "ONLINE") toast.success(`${t.status.ONLINE} · ${r.data.latencyMs}ms`);
    else toast.error(errorText(r.data.code));
  }

  async function setPreferred(m: Model) {
    if (!routing.data) return;
    await supabase
      .from("routing_preferences")
      .update({ preferred_model_id: m.id, preferred_provider_id: m.provider_id })
      .eq("id", routing.data.id);
    qc.invalidateQueries({ queryKey: qk.routing });
    toast.success(t.models.preferred);
  }

  return (
    <>
      <PageHeader title={t.models.title} sub={`${filtered.length} ${t.models.count}`} />
      <PageBody className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder={t.models.searchPh}
            className="h-11 ps-9"
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {FILTER_ORDER.filter((f) => MODEL_FILTERS.includes(f)).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(0);
              }}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
              )}
            >
              {t.filters[f]}
            </button>
          ))}
        </div>

        {models.isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)
        ) : !models.data?.length ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">{t.models.empty}</div>
        ) : slice.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">{t.models.noMatch}</div>
        ) : (
          <ul className="space-y-2">
            {slice.map((m) => {
              const caps = capsOf(m);
              const lat = latencyOf(m);
              const preferred = routing.data?.preferred_model_id === m.id;
              return (
                <li key={m.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold" dir="ltr">
                        {m.display_name}
                      </div>
                      <div className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
                        {m.external_model_id}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{providerName.get(m.provider_id)}</div>
                    </div>
                    <StatusChip status={testing === m.id ? "CHECKING" : m.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Chip className={m.price_class.startsWith("FREE") ? "border-success/30 bg-success/10 text-success" : ""}>
                      {t.price[m.price_class as keyof typeof t.price] ?? m.price_class}
                    </Chip>
                    {m.context_length && (
                      <Chip>
                        {t.models.context}: <span className="ms-1 font-mono" dir="ltr">{formatCtx(m.context_length)}</span>
                      </Chip>
                    )}
                    {lat !== null && (
                      <Chip>
                        <Zap className="me-1 size-3" />
                        <span className="font-mono" dir="ltr">{lat}ms</span>
                      </Chip>
                    )}
                    {CAPABILITIES.filter((c) => c !== "chat" && (caps[c] === "SUPPORTED" || caps[c] === "INFERRED")).map((c) => (
                      <Chip key={c} className={caps[c] === "INFERRED" ? "border-dashed opacity-80" : ""}>
                        {t.caps[c]}
                        {caps[c] === "INFERRED" && <span className="ms-1 text-[10px] opacity-70">({t.models.inferred})</span>}
                      </Chip>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => test(m)} disabled={testing === m.id}>
                      {testing === m.id && <Loader2 className="size-4 animate-spin" />}
                      {t.models.test}
                    </Button>
                    <Button variant={preferred ? "secondary" : "ghost"} size="sm" onClick={() => setPreferred(m)} disabled={preferred}>
                      <Star className={cn("size-4", preferred && "fill-current text-warning")} />
                      {preferred ? t.models.preferred : t.models.setPreferred}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setPage(current - 1)} disabled={current === 0}>
              {t.common.previous}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t.common.page} {current + 1} {t.common.of} {pages}
            </span>
            <Button variant="outline" onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>
              {t.common.next}
            </Button>
          </div>
        )}
      </PageBody>
    </>
  );
}

function formatCtx(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : `${n}`;
}
