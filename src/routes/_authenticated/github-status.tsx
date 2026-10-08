import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Github, GitBranch, GitCommitHorizontal, KeyRound, Lock, XCircle } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { Chip } from "@/components/app/StatusChip";
import { Skeleton } from "@/components/ui/skeleton";
import { githubStatusQuery } from "@/lib/queries2";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/github-status")({
  head: () => ({
    meta: [
      { title: "حالة ربط GitHub — وكيل" },
      { name: "description", content: "حالة اتصال GitHub والمستودعات المرتبطة واكتمال رفع الكود." },
      { property: "og:title", content: "حالة ربط GitHub — وكيل" },
      { property: "og:description", content: "حالة اتصال GitHub في وكيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GithubStatusPage,
});

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

function GithubStatusPage() {
  const { t } = useI18n();
  const s = t.ghStatus;
  const q = useQuery(githubStatusQuery);

  if (q.isLoading) {
    return (
      <>
        <PageHeader title={s.title} />
        <PageBody className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </PageBody>
      </>
    );
  }

  const d = q.data;
  const conn = d?.connections[0] ?? null;
  const lastPush = d?.pushed[0] ?? null;

  return (
    <>
      <PageHeader title={s.title} />
      <PageBody className="space-y-5">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{s.connection}</h2>
          {conn ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <Github className="size-4" />
                  <span dir="ltr">@{conn.account_login}</span>
                  <Chip>{s.connStatus[conn.status] ?? conn.status}</Chip>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <KeyRound className="size-3.5" />
                  <span className="font-mono" dir="ltr">{conn.token_hint}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.lastChecked}: {fmt(conn.last_checked_at)}
                </div>
              </div>
              {conn.status === "ACTIVE" ? <CheckCircle2 className="size-8 text-primary" /> : <XCircle className="size-8 text-destructive" />}
            </div>
          ) : (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              {s.notConnected}{" "}
              <Link to="/github" className="font-medium text-primary hover:underline">
                GitHub
              </Link>
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{s.linkedRepos}</h2>
          {!d?.repos.length ? (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{s.noRepos}</p>
          ) : (
            <ul className="space-y-2">
              {d.repos.slice(0, 20).map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-sm font-semibold" dir="ltr">{r.full_name}</span>
                      {r.is_private && <Lock className="size-3.5 text-muted-foreground" />}
                    </div>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {r.default_branch} · {fmt(r.pushed_at)}
                    </div>
                  </div>
                  <Chip>{r.status}</Chip>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{s.uploads}</h2>
          <div className="rounded-xl border border-border bg-card p-4">
            {lastPush ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <CheckCircle2 className="size-5" /> {s.pushedOk}
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <GitBranch className="size-3.5" /> {s.branch}: <span className="font-mono" dir="ltr">{lastPush.branch_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GitCommitHorizontal className="size-3.5" /> {s.commit}: <span className="font-mono" dir="ltr">{lastPush.commit_sha?.slice(0, 12)}</span>
                  </div>
                  <div>
                    {s.at}: {fmt(lastPush.created_at)}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{s.pushedNone}</p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{s.recentEvents}</h2>
          {!d?.events.length ? (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{s.noEvents}</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {d.events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>{s.events[e.action] ?? e.action}</span>
                  <span className="text-xs text-muted-foreground">{fmt(e.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-muted-foreground">{s.note}</p>
      </PageBody>
    </>
  );
}
