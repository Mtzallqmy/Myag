// Stage 2 browser reads (RLS-scoped).
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type T<N extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][N]["Row"];
export type Project = T<"projects">;
export type AgentJob = T<"agent_jobs">;
export type JobStep = T<"agent_job_steps">;
export type Approval = T<"approvals">;
export type ChangeSet = T<"change_sets">;
export type ValidationRun = T<"validation_runs">;
export type GhConnection = T<"github_connections">;
export type GhRepo = T<"github_repositories">;
export type McpServer = T<"mcp_servers">;
export type McpTool = T<"mcp_tools">;

export const qk2 = {
  projects: ["projects"] as const,
  project: (id: string) => ["project", id] as const,
  projectPaths: (id: string) => ["project-paths", id] as const,
  jobs: ["jobs"] as const,
  projectJobs: (id: string) => ["project-jobs", id] as const,
  job: (id: string) => ["job", id] as const,
  approvals: ["approvals"] as const,
  changeSets: (projectId: string) => ["change-sets", projectId] as const,
  gh: ["gh"] as const,
  mcp: ["mcp"] as const,
  registry: ["registry"] as const,
  audit: (projectId: string) => ["audit", projectId] as const,
};

const must = <D>(r: { data: D | null; error: unknown }): D => {
  if (r.error) throw r.error;
  return r.data as D;
};

export const projectsQuery = queryOptions({
  queryKey: qk2.projects,
  queryFn: async () => must(await supabase.from("projects").select("*").order("updated_at", { ascending: false }).limit(200)),
});

export const projectQuery = (id: string) =>
  queryOptions({
    queryKey: qk2.project(id),
    queryFn: async (): Promise<Project | null> => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const projectPathsQuery = (id: string) =>
  queryOptions({
    queryKey: qk2.projectPaths(id),
    queryFn: async () => {
      const all: { path: string; size_bytes: number; is_binary: boolean; line_count: number }[] = [];
      for (let from = 0; from < 5000; from += 1000) {
        const rows = must(
          await supabase.from("project_files").select("path, size_bytes, is_binary, line_count").eq("project_id", id).order("path").range(from, from + 999),
        );
        all.push(...rows);
        if (rows.length < 1000) break;
      }
      return all;
    },
  });

export const jobsQuery = queryOptions({
  queryKey: qk2.jobs,
  queryFn: async () => must(await supabase.from("agent_jobs").select("*, projects(name)").order("created_at", { ascending: false }).limit(100)),
});

export const projectJobsQuery = (projectId: string) =>
  queryOptions({
    queryKey: qk2.projectJobs(projectId),
    queryFn: async () => must(await supabase.from("agent_jobs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50)),
  });

export const jobQuery = (id: string) =>
  queryOptions({
    queryKey: qk2.job(id),
    queryFn: async () => {
      const [job, steps, approvals, changeSets, runs] = await Promise.all([
        supabase.from("agent_jobs").select("*, projects(name, repository_id)").eq("id", id).maybeSingle(),
        supabase.from("agent_job_steps").select("*").eq("job_id", id).neq("step_type", "PATCH_PAYLOAD").order("step_number"),
        supabase.from("approvals").select("*").eq("job_id", id).order("created_at"),
        supabase.from("change_sets").select("*").eq("job_id", id).order("created_at"),
        supabase.from("validation_runs").select("*").eq("job_id", id).order("created_at"),
      ]);
      if (job.error) throw job.error;
      return { job: job.data, steps: must(steps), approvals: must(approvals), changeSets: must(changeSets), runs: must(runs) };
    },
  });

export const pendingApprovalsQuery = queryOptions({
  queryKey: qk2.approvals,
  queryFn: async () => must(await supabase.from("approvals").select("*").eq("status", "PENDING").order("created_at", { ascending: false }).limit(50)),
});

export const changeSetsQuery = (projectId: string) =>
  queryOptions({
    queryKey: qk2.changeSets(projectId),
    queryFn: async () => must(await supabase.from("change_sets").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50)),
  });

export const githubQuery = queryOptions({
  queryKey: qk2.gh,
  queryFn: async () => {
    const [conns, repos] = await Promise.all([
      supabase.from("github_connections").select("*").order("created_at"),
      supabase.from("github_repositories").select("*").order("pushed_at", { ascending: false, nullsFirst: false }).limit(500),
    ]);
    return { connections: must(conns), repos: must(repos) };
  },
});

export const mcpQuery = queryOptions({
  queryKey: qk2.mcp,
  queryFn: async () => {
    const [servers, tools, resources, prompts] = await Promise.all([
      supabase.from("mcp_servers").select("*").order("created_at"),
      supabase.from("mcp_tools").select("*").order("name"),
      supabase.from("mcp_resources").select("*").limit(500),
      supabase.from("mcp_prompts").select("*").limit(500),
    ]);
    return { servers: must(servers), tools: must(tools), resources: must(resources), prompts: must(prompts) };
  },
});

export const githubStatusQuery = queryOptions({
  queryKey: [...qk2.gh, "status"],
  queryFn: async () => {
    const [conns, repos, pushed, events] = await Promise.all([
      supabase.from("github_connections").select("*").order("created_at"),
      supabase.from("github_repositories").select("*").order("pushed_at", { ascending: false, nullsFirst: false }).limit(200),
      supabase.from("change_sets").select("id, project_id, branch_name, commit_sha, status, created_at").eq("status", "PUSHED").order("created_at", { ascending: false }).limit(20),
      supabase.from("audit_logs").select("id, action, created_at, metadata_json").in("action", ["GITHUB_CONNECTED", "REPOSITORY_IMPORTED", "GIT_PUSHED"]).order("created_at", { ascending: false }).limit(20),
    ]);
    return { connections: must(conns), repos: must(repos), pushed: must(pushed), events: must(events) };
  },
});

export const registryQuery = queryOptions({
  queryKey: qk2.registry,
  queryFn: async () => must(await supabase.from("integration_registry").select("*")),
});

export const auditQuery = (projectId: string) =>
  queryOptions({
    queryKey: qk2.audit(projectId),
    queryFn: async () => must(await supabase.from("audit_logs").select("*").eq("entity_id", projectId).order("created_at", { ascending: false }).limit(50)),
  });
