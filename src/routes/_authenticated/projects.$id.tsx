import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, File, Folder, Loader2, Home } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { ProjectStatus } from "@/components/app/ProjectStatus";
import { JobStatus } from "@/components/app/ApprovalCard";
import { CodeViewer } from "@/components/app/CodeViewer";
import { DiffViewer } from "@/components/app/DiffViewer";
import { Markdown } from "@/components/app/Markdown";
import { Chip } from "@/components/app/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { askProject, searchProject, type SearchHit } from "@/lib/projects.functions";
import type { AgentDepth } from "@/lib/agent/roles";
import { createAgentJob, getRuntimeStatus, runAgentJob } from "@/lib/agent.functions";
import { AGENT_MODES, type AgentMode } from "@/lib/agent/policy";
import { auditQuery, changeSetsQuery, projectJobsQuery, projectPathsQuery, projectQuery, qk2, type Project } from "@/lib/queries2";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({
    meta: [
      { title: "مشروع — وكيل" },
      { name: "description", content: "تصفح ملفات المشروع، ابحث، اسأل الوكيل، ونفّذ مهام برمجية." },
      { property: "og:title", content: "مشروع — وكيل" },
      { property: "og:description", content: "مساحة عمل المشروع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectPage,
});

const TABS = ["ask", "task", "files", "search", "changes", "tests", "info", "log"] as const;
type Tab = (typeof TABS)[number];

function ProjectPage() {
  const { id } = Route.useParams();
  const { t, dir } = useI18n();
  const qc = useQueryClient();
  const project = useQuery(projectQuery(id));
  const [tab, setTab] = useState<Tab>("ask");
  const [openFile, setOpenFile] = useState<{ path: string; line?: number | null } | null>(null);
  const Back = dir === "rtl" ? ArrowRight : ArrowLeft;

  useEffect(() => {
    const ch = supabase
      .channel(`project-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: qk2.project(id) });
        qc.invalidateQueries({ queryKey: qk2.projectPaths(id) });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  const open = (path: string, line?: number | null) => {
    setOpenFile({ path, line: line ?? null });
    setTab("files");
  };

  const p = project.data;
  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Link to="/projects" className="text-muted-foreground" aria-label={t.common.back}>
              <Back className="size-5" />
            </Link>
            <span className="truncate" dir="auto">{p?.name ?? "…"}</span>
          </span>
        }
        sub={p && <span className="inline-flex items-center gap-2"><ProjectStatus status={p.status} /> {p.file_count} {t.projects.files}</span>}
      />
      <div className="sticky top-[61px] z-20 border-b border-border bg-background/95 backdrop-blur md:top-[69px]">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 py-2 md:px-8">
          {TABS.map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {t.project[k]}
            </button>
          ))}
        </div>
      </div>
      <PageBody>
        {!p ? (
          <Skeleton className="h-40 w-full" />
        ) : tab === "ask" ? (
          <AskTab projectId={id} onOpen={open} />
        ) : tab === "task" ? (
          <TaskTab projectId={id} ready={p.status === "READY"} />
        ) : tab === "files" ? (
          <FilesTab projectId={id} openFile={openFile} setOpenFile={setOpenFile} />
        ) : tab === "search" ? (
          <SearchTab projectId={id} onOpen={open} />
        ) : tab === "changes" ? (
          <ChangesTab projectId={id} />
        ) : tab === "tests" ? (
          <TestsTab projectId={id} />
        ) : tab === "info" ? (
          <InfoTab project={p} />
        ) : (
          <LogTab projectId={id} />
        )}
      </PageBody>
    </>
  );
}

function AskTab({ projectId, onOpen }: { projectId: string; onOpen: (p: string, l?: number) => void }) {
  const { t, errorText } = useI18n();
  const ask = useServerFn(askProject);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ answer: string; references: { path: string; line: number }[]; model: string; ungrounded: string[] } | null>(null);
  async function go() {
    if (!q.trim()) return;
    setBusy(true);
    const r = await ask({ data: { projectId, question: q } }).catch(() => ({ ok: false as const, error: "UNEXPECTED" }));
    setBusy(false);
    if (!r.ok) {
      toast.error(errorText(r.error));
      return;
    }
    setRes(r.data);
  }
  return (
    <div className="space-y-4">
      <Textarea value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.project.askPh} dir="auto" rows={3} className="text-base" />
      <Button onClick={go} disabled={busy || !q.trim()}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        {t.project.askBtn}
      </Button>
      {res && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="font-mono text-xs text-muted-foreground" dir="ltr">{res.model}</div>
          <Markdown text={res.answer} />
          {res.ungrounded.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-2 text-sm">
              {t.project.ungrounded}: <span className="font-mono" dir="ltr">{res.ungrounded.join(", ")}</span>
            </div>
          )}
          {res.references.length > 0 && (
            <div>
              <div className="mb-1.5 text-sm font-semibold">{t.project.references}</div>
              <div className="flex flex-wrap gap-1.5">
                {res.references.map((r) => (
                  <button key={`${r.path}:${r.line}`} onClick={() => onOpen(r.path, r.line)} className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs hover:bg-accent" dir="ltr">
                    {r.path}:{r.line}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskTab({ projectId, ready }: { projectId: string; ready: boolean }) {
  const { t, errorText } = useI18n();
  const navigate = useNavigate();
  const create = useServerFn(createAgentJob);
  const run = useServerFn(runAgentJob);
  const [mode, setMode] = useState<AgentMode>("SUGGEST");
  const [req, setReq] = useState("");
  const [depth, setDepth] = useState<AgentDepth>("BALANCED");
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    const r = await create({ data: { projectId, mode, request: req, depth } }).catch(() => ({ ok: false as const, error: "UNEXPECTED" }));
    setBusy(false);
    if (!r.ok) {
      toast.error(errorText(r.error));
      return;
    }
    void run({ data: { jobId: r.data.id } }).then((x) => {
      if (!x.ok && x.error !== "ALREADY_STARTED") toast.error(errorText(x.error));
    });
    navigate({ to: "/tasks/$id", params: { id: r.data.id } });
  }
  return (
    <div className="space-y-4">
      <Textarea value={req} onChange={(e) => setReq(e.target.value)} placeholder={t.project.taskPh} dir="auto" rows={4} className="text-base" />
      <div>
        <div className="mb-2 text-sm font-semibold">{t.project.mode}</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {AGENT_MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn("rounded-xl border p-3 text-start transition-colors", mode === m ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted")}
            >
              <div className="font-semibold">{t.modes[m]}</div>
              <div className="text-sm text-muted-foreground">{t.modesDesc[m]}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm font-semibold">{t.depth.title}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t.depth.title}>
          {(["FAST", "BALANCED", "DEEP", "MULTI"] as const).map((d) => (
            <button
              key={d}
              role="radio"
              aria-checked={depth === d}
              onClick={() => setDepth(d)}
              className={cn("min-h-11 rounded-xl border p-3 text-start transition-colors", depth === d ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted")}
            >
              <div className="font-semibold">{t.depth[d]}</div>
              <div className="text-sm text-muted-foreground">{t.depth.hint[d]}</div>
            </button>
          ))}
        </div>
      </div>
      <Button onClick={start} disabled={busy || req.trim().length < 3 || !ready} className="h-11">
        {busy && <Loader2 className="size-4 animate-spin" />}
        {t.project.start}
      </Button>
      <ProjectJobs projectId={projectId} />
    </div>
  );
}

function ProjectJobs({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const jobs = useQuery(projectJobsQuery(projectId));
  if (!jobs.data?.length) return null;
  return (
    <ul className="space-y-2 pt-2">
      {jobs.data.map((j) => (
        <li key={j.id}>
          <Link to="/tasks/$id" params={{ id: j.id }} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-muted">
            <span className="truncate text-sm" dir="auto">{j.request_text}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground">{t.modes[j.mode]}</span>
              <JobStatus status={j.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FilesTab({
  projectId,
  openFile,
  setOpenFile,
}: {
  projectId: string;
  openFile: { path: string; line?: number | null } | null;
  setOpenFile: (f: { path: string; line?: number | null } | null) => void;
}) {
  const { t, dir } = useI18n();
  const paths = useQuery(projectPathsQuery(projectId));
  const [cwd, setCwd] = useState("");
  const [filter, setFilter] = useState("");
  const Chevron = dir === "rtl" ? ChevronLeft : ChevronRight;

  useEffect(() => {
    if (openFile) setCwd(openFile.path.split("/").slice(0, -1).join("/"));
  }, [openFile]);

  const entries = useMemo(() => {
    const list = paths.data ?? [];
    const prefix = cwd ? `${cwd}/` : "";
    const dirs = new Map<string, number>();
    const files: typeof list = [];
    for (const f of list) {
      if (!f.path.startsWith(prefix)) continue;
      const rest = f.path.slice(prefix.length);
      const i = rest.indexOf("/");
      if (i >= 0) dirs.set(rest.slice(0, i), (dirs.get(rest.slice(0, i)) ?? 0) + 1);
      else files.push(f);
    }
    const fl = filter.toLowerCase();
    return {
      dirs: [...dirs.entries()].filter(([d]) => !fl || d.toLowerCase().includes(fl)).sort(([a], [b]) => a.localeCompare(b)),
      files: files.filter((f) => !fl || f.path.toLowerCase().includes(fl)).slice(0, 500),
    };
  }, [paths.data, cwd, filter]);

  if (openFile) return <FileView projectId={projectId} path={openFile.path} line={openFile.line ?? null} onBack={() => setOpenFile(null)} />;

  const crumbs = cwd ? cwd.split("/") : [];
  return (
    <div className="space-y-3">
      <nav className="flex flex-wrap items-center gap-1 text-sm" dir="ltr">
        <button onClick={() => setCwd("")} className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted">
          <Home className="size-3.5" />
        </button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <button onClick={() => setCwd(crumbs.slice(0, i + 1).join("/"))} className="rounded px-1.5 py-0.5 font-mono hover:bg-muted">
              {c}
            </button>
          </span>
        ))}
      </nav>
      <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t.common.search} className="h-10" />
      {paths.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card" dir="ltr">
          {entries.dirs.map(([d, n]) => (
            <li key={d}>
              <button onClick={() => setCwd(cwd ? `${cwd}/${d}` : d)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start hover:bg-muted">
                <Folder className="size-4 text-primary" />
                <span className="flex-1 truncate font-mono text-sm">{d}</span>
                <span className="text-xs text-muted-foreground">{n}</span>
                <Chevron className="size-4 text-muted-foreground" />
              </button>
            </li>
          ))}
          {entries.files.map((f) => (
            <li key={f.path}>
              <button onClick={() => setOpenFile({ path: f.path })} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start hover:bg-muted">
                <File className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate font-mono text-sm">{f.path.split("/").pop()}</span>
                <span className="text-xs text-muted-foreground">{f.is_binary ? "bin" : `${f.line_count} L`}</span>
              </button>
            </li>
          ))}
          {!entries.dirs.length && !entries.files.length && <li className="p-6 text-center text-muted-foreground">{t.project.noResults}</li>}
        </ul>
      )}
    </div>
  );
}

function FileView({ projectId, path, line, onBack }: { projectId: string; path: string; line: number | null; onBack: () => void }) {
  const { t, dir } = useI18n();
  const Back = dir === "rtl" ? ArrowRight : ArrowLeft;
  const q = useQuery({
    queryKey: ["file", projectId, path],
    queryFn: async () => {
      const { data: f } = await supabase.from("project_files").select("id, language, is_binary, size_bytes, metadata_json").eq("project_id", projectId).eq("path", path).maybeSingle();
      if (!f) return null;
      const { data: chunks } = await supabase.from("project_chunks").select("content").eq("file_id", f.id).order("chunk_index");
      return { ...f, content: (chunks ?? []).map((c) => c.content).join("\n"), indexed: (chunks ?? []).length > 0 };
    },
  });
  useEffect(() => {
    if (line) setTimeout(() => window.scrollTo({ top: Math.max(0, (line - 5) * 21 + 200), behavior: "smooth" }), 200);
  }, [line, q.data]);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={t.common.back}>
          <Back className="size-4" />
        </Button>
        <span className="truncate font-mono text-sm" dir="ltr">{path}</span>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !q.data ? (
        <p className="text-muted-foreground">{t.project.noResults}</p>
      ) : q.data.is_binary ? (
        <p className="rounded-lg border border-border bg-muted p-4 text-muted-foreground">{t.project.binary}</p>
      ) : !q.data.indexed ? (
        <p className="rounded-lg border border-border bg-muted p-4 text-muted-foreground">{t.project.notIndexed}</p>
      ) : (
        <CodeViewer code={q.data.content} language={q.data.language} highlightLine={line} />
      )}
    </div>
  );
}

function SearchTab({ projectId, onOpen }: { projectId: string; onOpen: (p: string, l?: number | null) => void }) {
  const { t, errorText } = useI18n();
  const search = useServerFn(searchProject);
  const [q, setQ] = useState("");
  const [kinds, setKinds] = useState<("file" | "text" | "symbol")[]>(["file", "symbol", "text"]);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  async function go(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim() || !kinds.length) return;
    setBusy(true);
    const r = await search({ data: { projectId, query: q, kinds } }).catch(() => ({ ok: false as const, error: "UNEXPECTED" }));
    setBusy(false);
    if (!r.ok) {
      toast.error(errorText(r.error));
      return;
    }
    setHits(r.data);
  }
  return (
    <div className="space-y-3">
      <form onSubmit={go} className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.project.searchPh} className="h-11" />
        <Button type="submit" className="h-11" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : t.common.search}
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {(["file", "symbol", "text"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]))}
            className={cn("rounded-full border px-3 py-1 text-sm", kinds.includes(k) ? "border-primary bg-accent text-accent-foreground" : "border-border")}
          >
            {t.project.kinds[k]}
          </button>
        ))}
      </div>
      {hits && !hits.length && <p className="text-muted-foreground">{t.project.noResults}</p>}
      {hits && hits.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card" dir="ltr">
          {hits.slice(0, 150).map((h, i) => (
            <li key={i}>
              <button onClick={() => onOpen(h.path, h.line)} className="block w-full px-3 py-2.5 text-start hover:bg-muted">
                <div className="flex items-center gap-2">
                  <Chip className="text-[10px]">{h.kind}</Chip>
                  <span className="truncate font-mono text-sm">
                    {h.path}
                    {h.line ? `:${h.line}` : ""}
                  </span>
                </div>
                {h.kind !== "file" && <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{h.preview}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChangesTab({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const cs = useQuery(changeSetsQuery(projectId));
  const [sel, setSel] = useState<string | null>(null);
  if (cs.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!cs.data?.length) return <p className="text-muted-foreground">{t.project.noChanges}</p>;
  const current = cs.data.find((c) => c.id === sel) ?? cs.data[0]!;
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {cs.data.map((c) => (
          <button
            key={c.id}
            onClick={() => setSel(c.id)}
            className={cn("shrink-0 rounded-lg border px-3 py-2 text-start text-sm", current.id === c.id ? "border-primary bg-accent" : "border-border bg-card")}
          >
            <div className="max-w-56 truncate font-medium" dir="auto">{c.summary || c.id.slice(0, 8)}</div>
            <div className="text-xs text-muted-foreground">{c.status}{c.branch_name ? ` · ${c.branch_name}` : ""}</div>
          </button>
        ))}
      </div>
      {current.job_id && (
        <Link to="/tasks/$id" params={{ id: current.job_id }} className="text-sm font-medium text-primary">
          {t.common.seeAll} →
        </Link>
      )}
      <DiffViewer diff={current.diff_text} />
    </div>
  );
}

function TestsTab({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const status = useServerFn(getRuntimeStatus);
  const rt = useQuery({ queryKey: ["runtime-status"], queryFn: () => status() });
  const runs = useQuery({
    queryKey: ["project-runs", projectId],
    queryFn: async () => {
      const { data: jobs } = await supabase.from("agent_jobs").select("id").eq("project_id", projectId).limit(100);
      const ids = (jobs ?? []).map((j) => j.id);
      if (!ids.length) return [];
      const { data } = await supabase.from("validation_runs").select("*").in("job_id", ids).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <div className="space-y-3">
      <div className={cn("rounded-xl border p-4", rt.data?.configured ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10")}>
        {rt.data?.configured ? t.project.runtimeReady : t.project.runtimeUnavailable}
      </div>
      {!runs.data?.length ? (
        <p className="text-muted-foreground">{t.project.noRuns}</p>
      ) : (
        <ul className="space-y-2">
          {runs.data.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm" dir="ltr">{r.command_label}</span>
                <Chip>{r.status}</Chip>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{r.summary === "RUNTIME_NOT_CONFIGURED" ? t.project.runtimeUnavailable : r.summary}</div>
              {r.output_excerpt && <pre className="mt-2 max-h-48 overflow-auto rounded bg-code p-2 text-xs text-code-foreground" dir="ltr">{r.output_excerpt}</pre>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InfoTab({ project }: { project: Project }) {
  const { t } = useI18n();
  const langs = Object.entries((project.language_summary ?? {}) as Record<string, number>).sort((a, b) => b[1] - a[1]);
  const fw = (project.framework_summary ?? {}) as Record<string, string[] | undefined>;
  const row = (label: string, items?: string[]) => (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 text-sm font-semibold text-muted-foreground">{label}</div>
      {items?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((i) => (
            <Chip key={i}><span dir="ltr">{i}</span></Chip>
          ))}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">{t.project.noneDetected}</span>
      )}
    </div>
  );
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {row(t.project.languages, langs.map(([l, n]) => `${l} (${n})`))}
      {row(t.project.frameworks, fw["frameworks"])}
      {row(t.project.packageManagers, fw["packageManagers"])}
      {row(t.project.buildSystems, fw["buildSystems"])}
      {row(t.project.testFrameworks, fw["testFrameworks"])}
      {row(t.project.entryPoints, fw["entryPoints"])}
      {row(t.project.manifests, fw["manifests"])}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 text-sm font-semibold text-muted-foreground">{t.project.size}</div>
        <span className="font-mono" dir="ltr">{(Number(project.size_bytes) / 1024 / 1024).toFixed(2)} MB · {project.file_count} files</span>
        {project.workspace_ref && <div className="mt-1 font-mono text-xs text-muted-foreground" dir="ltr">{project.workspace_ref}</div>}
      </div>
    </div>
  );
}

function LogTab({ projectId }: { projectId: string }) {
  const { lang } = useI18n();
  const audit = useQuery(auditQuery(projectId));
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {(audit.data ?? []).map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="font-mono text-sm" dir="ltr">{a.action}</span>
            <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString(lang === "ar" ? "ar" : "en", { dateStyle: "short", timeStyle: "short" })}</span>
          </li>
        ))}
      </ul>
      <ProjectJobs projectId={projectId} />
    </div>
  );
}
