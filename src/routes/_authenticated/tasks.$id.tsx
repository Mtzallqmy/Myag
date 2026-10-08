import { RoleProgress } from "@/components/app/RoleProgress";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, ExternalLink, GitBranch, GitPullRequest, Loader2, XCircle } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { ApprovalCard, JobStatus } from "@/components/app/ApprovalCard";
import { DiffViewer } from "@/components/app/DiffViewer";
import { Markdown } from "@/components/app/Markdown";
import { Chip } from "@/components/app/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { cancelAgentJob, requestGitAction } from "@/lib/agent.functions";
import { jobQuery, qk2, type ChangeSet } from "@/lib/queries2";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/tasks/$id")({
  head: () => ({
    meta: [
      { title: "مهمة — وكيل" },
      { name: "description", content: "تقدم مهمة الوكيل، الفرق المقترح، والموافقات." },
      { property: "og:title", content: "مهمة — وكيل" },
      { property: "og:description", content: "تفاصيل مهمة الوكيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TaskPage,
});

const FINAL = ["COMPLETED", "FAILED", "CANCELLED", "APPLIED_UNVERIFIED", "VALIDATION_FAILED", "INTERRUPTED"];

function TaskPage() {
  const { id } = Route.useParams();
  const { t, dir, errorText } = useI18n();
  const qc = useQueryClient();
  const q = useQuery(jobQuery(id));
  const cancel = useServerFn(cancelAgentJob);
  const Back = dir === "rtl" ? ArrowRight : ArrowLeft;

  // Realtime progress (operational status only).
  useEffect(() => {
    const inv = () => qc.invalidateQueries({ queryKey: qk2.job(id) });
    const ch = supabase
      .channel(`job-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_jobs", filter: `id=eq.${id}` }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_job_steps", filter: `job_id=eq.${id}` }, inv)
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals", filter: `job_id=eq.${id}` }, inv)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  if (q.isLoading || !q.data?.job) return <PageBody><Skeleton className="h-60 w-full" /></PageBody>;
  const { job, steps, approvals, changeSets, runs } = q.data;
  const project = (job as { projects?: { name: string; repository_id: string | null } | null }).projects;
  const pending = approvals.filter((a) => a.status === "PENDING");

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Link to="/tasks" className="text-muted-foreground" aria-label={t.common.back}>
              <Back className="size-5" />
            </Link>
            {t.jobs.title}
          </span>
        }
        sub={
          <Link to="/projects/$id" params={{ id: job.project_id }} className="hover:underline">
            {project?.name}
          </Link>
        }
        actions={
          !FINAL.includes(job.status) && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const r = await cancel({ data: { jobId: id } });
                if (!r.ok) toast.error(errorText(r.error));
                qc.invalidateQueries({ queryKey: qk2.job(id) });
              }}
            >
              {t.jobs.cancel}
            </Button>
          )
        }
      />
      <PageBody className="space-y-5">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <JobStatus status={job.status} />
            <Chip>{t.modes[job.mode]}</Chip>
          </div>
          <p className="whitespace-pre-wrap text-[15px]" dir="auto">{job.request_text}</p>
          <Progress value={job.progress} className="mt-4" />
          {job.error_code && <p className="mt-3 text-sm text-destructive">{errorText(job.error_code)}</p>}
        </section>

        {pending.map((a) => (
          <ApprovalCard key={a.id} a={a} />
        ))}

        <RoleProgress orchestration={job.orchestration} steps={steps} />

        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{t.jobs.steps}</h2>
          <ol className="space-y-2">
            {steps.map((s) => (
              <li key={s.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                {s.status === "DONE" ? <CheckCircle2 className="mt-0.5 size-4 text-success" /> : s.status === "FAILED" ? <XCircle className="mt-0.5 size-4 text-destructive" /> : <Circle className="mt-0.5 size-4" />}
                <div className="min-w-0">
                  <div className="font-medium">{t.jobs.stepTypes[s.step_type] ?? s.step_type}</div>
                  {s.summary && <div className="text-sm text-muted-foreground" dir="auto">{s.summary}</div>}
                </div>
              </li>
            ))}
            {!FINAL.includes(job.status) && job.status !== "AWAITING_APPROVAL" && (
              <li className="flex items-center gap-3 rounded-lg border border-dashed border-border p-3 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {t.jobs.status[job.status]}
              </li>
            )}
          </ol>
        </section>

        {job.result_summary && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{t.jobs.result}</h2>
            <Markdown text={job.result_summary} />
          </section>
        )}

        {changeSets.map((cs) => (
          <ChangeSetPanel key={cs.id} cs={cs} hasRepo={!!project?.repository_id} canGit={job.mode === "WORKSPACE" || job.mode === "SUGGEST"} />
        ))}

        {runs.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{t.jobs.validation}</h2>
            {runs.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                <div className="flex items-center justify-between"><span className="font-mono" dir="ltr">{r.command_label}</span><Chip>{r.status}</Chip></div>
                <div className="mt-1 text-muted-foreground">{r.summary === "RUNTIME_NOT_CONFIGURED" ? t.project.runtimeUnavailable : r.summary}</div>
              </div>
            ))}
          </section>
        )}
      </PageBody>
    </>
  );
}

function ChangeSetPanel({ cs, hasRepo, canGit }: { cs: ChangeSet; hasRepo: boolean; canGit: boolean }) {
  const { t, errorText } = useI18n();
  const qc = useQueryClient();
  const request = useServerFn(requestGitAction);
  const [title, setTitle] = useState(cs.summary.slice(0, 100));
  const [body, setBody] = useState(cs.summary);
  const [busy, setBusy] = useState(false);

  async function ask(action: "github.push" | "github.create_pr") {
    setBusy(true);
    const r = await request({ data: { changeSetId: cs.id, action, ...(action === "github.create_pr" ? { title, body } : {}) } }).catch(() => ({ ok: false as const, error: "UNEXPECTED" }));
    setBusy(false);
    if (!r.ok) toast.error(errorText(r.error));
    else toast.success(t.jobs.requested);
    qc.invalidateQueries();
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">{t.jobs.diff}</h2>
      {cs.summary && <p className="text-[15px]" dir="auto">{cs.summary}</p>}
      <DiffViewer diff={cs.diff_text} />
      {hasRepo && canGit && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t.github.defaultBranchNote}</p>
          {cs.branch_name && (
            <div className="flex items-center gap-2 text-sm">
              <GitBranch className="size-4" /> {t.jobs.branch}: <span className="font-mono" dir="ltr">{cs.branch_name}</span>
            </div>
          )}
          {!cs.branch_name && (
            <Button onClick={() => ask("github.push")} disabled={busy} variant="outline">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <GitBranch className="size-4" />}
              {t.jobs.pushBranch}
            </Button>
          )}
          {cs.branch_name && !cs.pr_url && (
            <div className="space-y-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.jobs.prTitle} dir="auto" />
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.jobs.prBody} rows={4} dir="auto" />
              <Button onClick={() => ask("github.create_pr")} disabled={busy || !title.trim()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <GitPullRequest className="size-4" />}
                {t.jobs.createPr}
              </Button>
            </div>
          )}
          {cs.pr_url && (
            <a href={cs.pr_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-primary">
              <ExternalLink className="size-4" /> {t.jobs.openPr}
            </a>
          )}
        </div>
      )}
    </section>
  );
}
