import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { ApprovalCard, JobStatus } from "@/components/app/ApprovalCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { jobsQuery, pendingApprovalsQuery, qk2 } from "@/lib/queries2";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/tasks/")({
  head: () => ({
    meta: [
      { title: "المهام — وكيل" },
      { name: "description", content: "مهام الوكيل وحالتها والموافقات المعلقة." },
      { property: "og:title", content: "المهام — وكيل" },
      { property: "og:description", content: "مهام الوكيل والموافقات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const jobs = useQuery(jobsQuery);
  const approvals = useQuery(pendingApprovalsQuery);

  useEffect(() => {
    const ch = supabase
      .channel("jobs-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_jobs" }, () => qc.invalidateQueries({ queryKey: qk2.jobs }))
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, () => qc.invalidateQueries({ queryKey: qk2.approvals }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const pending = (approvals.data ?? []).filter((a) => new Date(a.expires_at) > new Date());

  return (
    <>
      <PageHeader title={t.jobs.title} />
      <PageBody className="space-y-5">
        {pending.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{t.jobs.pendingApprovals}</h2>
            {pending.map((a) => (
              <ApprovalCard
                key={a.id}
                a={a}
                detailsHref={
                  a.job_id ? (
                    <Link to="/tasks/$id" params={{ id: a.job_id }} className="inline-flex h-10 items-center px-3 text-sm font-medium text-primary">
                      {t.approval.details}
                    </Link>
                  ) : null
                }
              />
            ))}
          </section>
        )}
        {jobs.isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : !jobs.data?.length ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">{t.jobs.empty}</div>
        ) : (
          <ul className="space-y-2">
            {jobs.data.map((j) => (
              <li key={j.id}>
                <Link to="/tasks/$id" params={{ id: j.id }} className="block rounded-xl border border-border bg-card p-4 hover:bg-muted">
                  <div className="flex items-start justify-between gap-3">
                    <span className="line-clamp-2 font-medium" dir="auto">{j.request_text}</span>
                    <JobStatus status={j.status} />
                  </div>
                  <div className="mt-1.5 text-sm text-muted-foreground">
                    {(j as { projects?: { name: string } | null }).projects?.name} · {t.modes[j.mode]} ·{" "}
                    {new Date(j.created_at).toLocaleString(lang === "ar" ? "ar" : "en", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}
