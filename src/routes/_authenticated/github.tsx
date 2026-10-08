import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, KeyRound, Loader2, Lock, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { Chip } from "@/components/app/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { connectGithub, disconnectGithub, importRepository, listRepoItems, refreshGithub, type GhItem } from "@/lib/github.functions";
import { githubQuery, qk2, type GhRepo } from "@/lib/queries2";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/github")({
  head: () => ({
    meta: [
      { title: "GitHub — وكيل" },
      { name: "description", content: "اربط GitHub، استورد المستودعات، واعرض Issues و Pull Requests." },
      { property: "og:title", content: "GitHub — وكيل" },
      { property: "og:description", content: "تكامل GitHub في وكيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GithubPage,
});

function GithubPage() {
  const { t, errorText } = useI18n();
  const qc = useQueryClient();
  const gh = useQuery(githubQuery);
  const connect = useServerFn(connectGithub);
  const refresh = useServerFn(refreshGithub);
  const disconnect = useServerFn(disconnectGithub);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<GhRepo | null>(null);

  const repos = useMemo(() => (gh.data?.repos ?? []).filter((r) => !q || r.full_name.toLowerCase().includes(q.toLowerCase())), [gh.data, q]);

  async function doConnect(e: React.FormEvent) {
    e.preventDefault();
    setBusy("connect");
    const r = await connect({ data: { token } }).catch(() => ({ ok: false as const, error: "UNEXPECTED" }));
    setBusy(null);
    setToken("");
    if (!r.ok) {
      toast.error(errorText(r.error));
      return;
    }
    toast.success(`${t.github.connected} ${r.data.login}`);
    qc.invalidateQueries({ queryKey: qk2.gh });
  }

  return (
    <>
      <PageHeader title={t.github.title} />
      <PageBody className="space-y-5">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{t.github.connections}</h2>
          {gh.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            (gh.data?.connections ?? []).map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <div className="font-semibold" dir="ltr">@{c.account_login}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <KeyRound className="size-3.5" />
                    <span className="font-mono" dir="ltr">{c.token_hint}</span>
                    <Chip>{c.status}</Chip>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === c.id}
                    onClick={async () => {
                      setBusy(c.id);
                      const r = await refresh({ data: { connectionId: c.id } });
                      setBusy(null);
                      if (!r.ok) toast.error(errorText(r.error));
                      qc.invalidateQueries({ queryKey: qk2.gh });
                    }}
                  >
                    {busy === c.id ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    {t.github.refresh.replace("🔄 ", "")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={async () => {
                      if (!confirm(t.github.disconnectConfirm)) return;
                      await disconnect({ data: { connectionId: c.id } });
                      qc.invalidateQueries({ queryKey: qk2.gh });
                    }}
                  >
                    <Unplug className="size-4" /> {t.github.disconnect}
                  </Button>
                </div>
              </div>
            ))
          )}
          {!gh.isLoading && !gh.data?.connections.length && (
            <form onSubmit={doConnect} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold">{t.github.connect}</h3>
              <div className="space-y-1.5">
                <Label htmlFor="ghtoken">{t.github.tokenLabel}</Label>
                <Input id="ghtoken" type="password" dir="ltr" autoComplete="off" className="h-11 font-mono text-sm" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} />
                <p className="text-xs text-muted-foreground">{t.github.tokenHelp}</p>
              </div>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /> {t.providers.secureNote}
              </p>
              <Button type="submit" disabled={busy === "connect" || token.length < 20}>
                {busy === "connect" && <Loader2 className="size-4 animate-spin" />}
                {t.github.connect.replace("🔗 ", "")}
              </Button>
            </form>
          )}
        </section>

        {!!gh.data?.repos.length && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{t.github.repos}</h2>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.github.searchRepos} className="h-10" />
            <ul className="space-y-2">
              {repos.slice(0, 100).map((r) => (
                <RepoRow key={r.id} repo={r} expanded={selected?.id === r.id} onToggle={() => setSelected(selected?.id === r.id ? null : r)} />
              ))}
            </ul>
          </section>
        )}
        {!gh.isLoading && !gh.data?.connections.length && <p className="text-muted-foreground">{t.github.none}</p>}
      </PageBody>
    </>
  );
}

function RepoRow({ repo, expanded, onToggle }: { repo: GhRepo; expanded: boolean; onToggle: () => void }) {
  const { t, errorText } = useI18n();
  const navigate = useNavigate();
  const importRepo = useServerFn(importRepository);
  const items = useServerFn(listRepoItems);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<"issues" | "pulls">("issues");
  const list = useQuery({
    queryKey: ["gh-items", repo.id, kind],
    enabled: expanded,
    queryFn: async () => {
      const r = await items({ data: { repositoryId: repo.id, kind } });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });

  return (
    <li className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 p-3">
        <button onClick={onToggle} className="min-w-0 flex-1 text-start">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-sm font-semibold" dir="ltr">{repo.full_name}</span>
            {repo.is_private && <Lock className="size-3.5 text-muted-foreground" />}
          </div>
          <div className="truncate text-xs text-muted-foreground" dir="auto">{repo.description || repo.default_branch}</div>
        </button>
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            toast.info(t.github.importing);
            const r = await importRepo({ data: { repositoryId: repo.id } }).catch(() => ({ ok: false as const, error: "UNEXPECTED" }));
            setBusy(false);
            if (!r.ok) {
              toast.error(errorText(r.error));
              return;
            }
            toast.success(t.github.imported);
            navigate({ to: "/projects/$id", params: { id: r.data.projectId } });
          }}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {t.github.import}
        </Button>
      </div>
      {expanded && (
        <div className="space-y-2 border-t border-border p-3">
          <div className="flex gap-2">
            {(["issues", "pulls"] as const).map((k) => (
              <Button key={k} size="sm" variant={kind === k ? "secondary" : "ghost"} onClick={() => setKind(k)}>
                {t.github[k]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t.github.untrusted}</p>
          {list.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : list.error ? (
            <p className="text-sm text-destructive">{errorText((list.error as Error).message)}</p>
          ) : !list.data?.length ? (
            <p className="text-sm text-muted-foreground">{t.project.noResults}</p>
          ) : (
            <ul className="space-y-1.5">
              {list.data.map((i: GhItem) => (
                <li key={i.number} className="rounded-lg bg-muted/60 p-2.5">
                  <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-start gap-2 text-sm font-medium hover:underline">
                    <span className="font-mono text-muted-foreground" dir="ltr">#{i.number}</span>
                    <span className="min-w-0 flex-1" dir="auto">{i.title}</span>
                    <ExternalLink className="size-3.5 shrink-0" />
                  </a>
                  <div className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
                    @{i.user} · {i.state}
                    {i.checks ? ` · checks: ${i.checks}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
