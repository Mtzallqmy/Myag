import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FolderGit2, FolderUp, Github, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { createProject, finalizeProjectIngest, ingestProjectBatch } from "@/lib/projects.functions";
import { ArchiveRejected } from "@/lib/projects/archive";
import { batchFiles, prepareFiles, type Progress as UploadProgress } from "@/lib/projects/upload";
import { projectsQuery, qk2, type Project } from "@/lib/queries2";
import { useI18n } from "@/lib/i18n";
import { ProjectStatus } from "@/components/app/ProjectStatus";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "المشاريع — وكيل" },
      { name: "description", content: "ارفع مشاريعك البرمجية أو استوردها من GitHub، وتصفحها وابحث فيها." },
      { property: "og:title", content: "المشاريع — وكيل" },
      { property: "og:description", content: "مشاريعك البرمجية في وكيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const projects = useQuery(projectsQuery);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const ch = supabase
      .channel("projects-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => qc.invalidateQueries({ queryKey: qk2.projects }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const list = useMemo(() => (projects.data ?? []).filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())), [projects.data, q]);

  async function remove(p: Project) {
    if (!confirm(t.projects.deleteConfirm)) return;
    await supabase.from("projects").delete().eq("id", p.id);
    qc.invalidateQueries({ queryKey: qk2.projects });
  }

  return (
    <>
      <PageHeader
        title={t.projects.title}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t.projects.new.replace("➕ ", "")}</span>
          </Button>
        }
      />
      <PageBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setOpen(true)} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-start hover:bg-muted">
            <Upload className="size-5 text-primary" />
            <span className="font-semibold">{t.projects.upload}</span>
          </button>
          <Link to="/github" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted">
            <Github className="size-5 text-primary" />
            <span className="font-semibold">{t.projects.importGh}</span>
          </Link>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.projects.search} className="h-11 ps-9" />
        </div>

        <h2 className="text-sm font-semibold text-muted-foreground">{t.projects.recent}</h2>
        {projects.isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-20 w-full" />)
        ) : !list.length ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">{t.projects.empty}</div>
        ) : (
          <ul className="space-y-2">
            {list.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl border border-border bg-card">
                <Link to="/projects/$id" params={{ id: p.id }} className="min-w-0 flex-1 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <FolderGit2 className="size-4 text-muted-foreground" />
                    <span className="truncate font-semibold" dir="auto">{p.name}</span>
                    <ProjectStatus status={p.status} />
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t.projects.source[p.source_type] ?? p.source_type} · {p.file_count} {t.projects.files} ·{" "}
                    {Object.keys((p.language_summary ?? {}) as Record<string, number>).slice(0, 3).join("، ") || "—"}
                  </div>
                </Link>
                <Button variant="ghost" size="icon" className="me-2 text-muted-foreground" onClick={() => remove(p)} aria-label={t.common.delete}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
      {open && <NewProjectDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const { t, errorText } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createProject);
  const ingest = useServerFn(ingestProjectBatch);
  const finalize = useServerFn(finalizeProjectIngest);
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dirRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const r = await create({ data: { name: name || files[0]?.name.replace(/\.zip$/i, "") || "Project", sourceType: files.length ? "UPLOAD" : "EMPTY" } });
    if (!r.ok) {
      toast.error(errorText(r.error));
      return;
    }
    const projectId = r.data.id;
    if (!files.length) {
      onClose();
      navigate({ to: "/projects/$id", params: { id: projectId } });
      return;
    }
    try {
      const prepared = await prepareFiles(files, u.user.id, projectId, setProgress);
      const batches = batchFiles(prepared);
      for (const [i, b] of batches.entries()) {
        setProgress({ phase: "INDEXING", done: i, total: batches.length });
        const br = await ingest({ data: { projectId, files: b } });
        if (!br.ok) throw new Error(br.error);
      }
      await finalize({ data: { projectId } });
      setProgress({ phase: "DONE", done: 1, total: 1 });
      qc.invalidateQueries({ queryKey: qk2.projects });
      onClose();
      navigate({ to: "/projects/$id", params: { id: projectId } });
    } catch (err) {
      const code = err instanceof ArchiveRejected ? err.code : err instanceof Error && /^[A-Z_]+$/.test(err.message) ? err.message : "UNEXPECTED";
      await finalize({ data: { projectId, failed: code } }).catch(() => undefined);
      toast.error(errorText(code));
      setProgress(null);
      qc.invalidateQueries({ queryKey: qk2.projects });
    }
  }

  const busy = progress !== null && progress.phase !== "DONE";
  const pct = progress ? Math.round(((progress.done + (progress.phase === "DONE" ? 0 : 0)) / Math.max(1, progress.total)) * 100) : 0;
  const phaseLabel =
    progress?.phase === "UPLOADING" ? t.projects.uploading : progress?.phase === "EXTRACTING" ? t.projects.extracting : t.projects.status["INDEXING"];

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.projects.new}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pn">{t.projects.name}</Label>
            <Input id="pn" className="h-11" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-20 flex-col" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload className="size-5" />
              <span className="text-xs">{t.projects.chooseFiles}</span>
            </Button>
            <Button type="button" variant="outline" className="h-20 flex-col" onClick={() => dirRef.current?.click()} disabled={busy}>
              <FolderUp className="size-5" />
              <span className="text-xs">{t.projects.chooseFolder}</span>
            </Button>
          </div>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => setFiles([...(e.target.files ?? [])])} />
          <input ref={dirRef} type="file" multiple hidden onChange={(e) => setFiles([...(e.target.files ?? [])])} />
          <p className="text-xs text-muted-foreground">{t.projects.supported}</p>
          {files.length > 0 && (
            <p className="text-sm">
              {files.length} {t.projects.files}
              {files.length === 1 && <span className="ms-2 font-mono text-muted-foreground" dir="ltr">{files[0]!.name}</span>}
            </p>
          )}
          {progress && (
            <div className="space-y-1.5">
              <div className="text-sm text-muted-foreground">{phaseLabel}…</div>
              <Progress value={progress.phase === "DONE" ? 100 : pct} />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t.projects.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
