// GitHub integration (fine-grained PAT, encrypted server-side).
import { defineOperation } from "./operation";
import { z } from "zod";
import { tokenHint } from "@/lib/server/crypto.server";
import { loadGithubToken, storeGithubToken } from "@/lib/server/secrets.server";
import { downloadZipball, gh, GithubError, listAllRepos } from "@/lib/server/github.server";
import { ArchiveRejected, isProbablyBinary, LIMITS, mimeOf, safeExtractZip } from "@/lib/projects/archive";
import { ingestFiles, finalizeProject } from "@/lib/server/ingest.server";
import { redactSecrets } from "@/lib/security/redact";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const errCode = (e: unknown) => (e instanceof GithubError || e instanceof ArchiveRejected ? e.code : e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : "UNEXPECTED");

async function syncRepos(connectionId: string, userId: string, token: string) {
  const db = await admin();
  const repos = await listAllRepos(token);
  const rows = repos.map((r) => ({
    user_id: userId,
    connection_id: connectionId,
    github_repo_id: r.id,
    full_name: r.full_name,
    default_branch: r.default_branch,
    is_private: r.private,
    permissions_json: (r.permissions ?? {}) as never,
    description: r.description?.slice(0, 500) ?? null,
    pushed_at: r.pushed_at,
    status: "AVAILABLE",
  }));
  for (let i = 0; i < rows.length; i += 200) await db.from("github_repositories").upsert(rows.slice(i, i + 200), { onConflict: "connection_id,github_repo_id" });
  await db.from("github_connections").update({ last_checked_at: new Date().toISOString(), status: "ACTIVE" }).eq("id", connectionId);
  return rows.length;
}

export const connectGithub = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().trim().min(20).max(400) }).parse(d))
  .handler(async ({ data, context }): Promise<Result<{ login: string; repos: number }>> => {
    try {
      const user = await gh<{ login: string; id: number }>(data.token, "/user");
      const db = await admin();
      const { data: conn, error } = await db
        .from("github_connections")
        .insert({ user_id: context.userId, auth_type: "PAT", account_login: user.login, account_id: user.id, token_hint: tokenHint(data.token), status: "ACTIVE" })
        .select("id")
        .single();
      if (error || !conn) return { ok: false, error: "CREATE_FAILED" };
      await storeGithubToken(conn.id, context.userId, data.token);
      const repos = await syncRepos(conn.id, context.userId, data.token);
      await db.from("integration_registry").upsert({ user_id: context.userId, integration_key: "github", status: "CONNECTED", ref_id: conn.id, metadata_json: { login: user.login } }, { onConflict: "user_id,integration_key" });
      await db.from("audit_logs").insert({ user_id: context.userId, action: "GITHUB_CONNECTED", entity_type: "github_connection", entity_id: conn.id, metadata_json: { login: user.login } });
      return { ok: true, data: { login: user.login, repos } };
    } catch (e) {
      return { ok: false, error: errCode(e) };
    }
  });

export const refreshGithub = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ connectionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<{ repos: number }>> => {
    const { data: c } = await context.supabase.from("github_connections").select("id").eq("id", data.connectionId).maybeSingle();
    if (!c) return { ok: false, error: "NOT_FOUND" };
    try {
      const token = await loadGithubToken(c.id, context.userId);
      return { ok: true, data: { repos: await syncRepos(c.id, context.userId, token) } };
    } catch (e) {
      if (e instanceof GithubError && e.code === "AUTH_FAILED") {
        const db = await admin();
        await db.from("github_connections").update({ status: "AUTH_FAILED" }).eq("id", c.id);
      }
      return { ok: false, error: errCode(e) };
    }
  });

export const disconnectGithub = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ connectionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<null>> => {
    const { error } = await context.supabase.from("github_connections").delete().eq("id", data.connectionId);
    if (error) return { ok: false, error: "DELETE_FAILED" };
    const db = await admin();
    const { count } = await db.from("github_connections").select("id", { count: "exact", head: true }).eq("user_id", context.userId);
    if (!count) await db.from("integration_registry").update({ status: "NOT_CONNECTED", ref_id: null }).eq("user_id", context.userId).eq("integration_key", "github");
    return { ok: true, data: null };
  });

export interface GhItem {
  number: number;
  title: string;
  state: string;
  user: string;
  url: string;
  body: string;
  updated_at: string;
  checks?: string | null;
}

/** Issues / PRs read view. Text is untrusted: redacted and never treated as instructions. */
export const listRepoItems = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ repositoryId: z.string().uuid(), kind: z.enum(["issues", "pulls"]) }).parse(d))
  .handler(async ({ data, context }): Promise<Result<GhItem[]>> => {
    const { data: repo } = await context.supabase.from("github_repositories").select("id, connection_id, full_name").eq("id", data.repositoryId).maybeSingle();
    if (!repo) return { ok: false, error: "NOT_FOUND" };
    try {
      const token = await loadGithubToken(repo.connection_id, context.userId);
      type Raw = { number: number; title: string; state: string; user?: { login: string }; html_url: string; body: string | null; updated_at: string; pull_request?: unknown; head?: { sha: string } };
      const items = await gh<Raw[]>(token, `/repos/${repo.full_name}/${data.kind}?state=open&per_page=30`);
      const out: GhItem[] = [];
      for (const i of items) {
        if (data.kind === "issues" && i.pull_request) continue;
        let checks: string | null = null;
        if (data.kind === "pulls" && i.head?.sha && out.length < 10) {
          try {
            const s = await gh<{ state: string }>(token, `/repos/${repo.full_name}/commits/${i.head.sha}/status`);
            checks = s.state;
          } catch {
            checks = null;
          }
        }
        out.push({
          number: i.number,
          title: redactSecrets(i.title).slice(0, 300),
          state: i.state,
          user: i.user?.login ?? "",
          url: i.html_url,
          body: redactSecrets(i.body ?? "").slice(0, 4000),
          updated_at: i.updated_at,
          checks,
        });
      }
      return { ok: true, data: out };
    } catch (e) {
      return { ok: false, error: errCode(e) };
    }
  });

/** Imports a repository snapshot (zipball, no clone URL stored) into a new project. */
export const importRepository = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ repositoryId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<{ projectId: string }>> => {
    const { data: repo } = await context.supabase.from("github_repositories").select("*").eq("id", data.repositoryId).maybeSingle();
    if (!repo) return { ok: false, error: "NOT_FOUND" };
    const db = await admin();
    let projectId: string | null = null;
    try {
      const token = await loadGithubToken(repo.connection_id, context.userId);
      // verify access server-side
      const live = await gh<{ default_branch: string; permissions?: { pull?: boolean } }>(token, `/repos/${repo.full_name}`);
      if (live.permissions && !live.permissions.pull) return { ok: false, error: "FORBIDDEN" };
      const ref = await gh<{ object: { sha: string } }>(token, `/repos/${repo.full_name}/git/ref/heads/${encodeURIComponent(live.default_branch)}`);
      const { data: p } = await db
        .from("projects")
        .insert({ user_id: context.userId, name: repo.full_name, source_type: "GITHUB", status: "PROCESSING", repository_id: repo.id, workspace_ref: `github:${repo.full_name}@${ref.object.sha.slice(0, 12)}` })
        .select("id")
        .single();
      if (!p) return { ok: false, error: "CREATE_FAILED" };
      projectId = p.id;
      const zip = await downloadZipball(token, repo.full_name, ref.object.sha, 25 * 1024 * 1024);
      const { files } = safeExtractZip(zip);
      await db.from("projects").update({ status: "INDEXING" }).eq("id", p.id);
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const batch = files.map((f) => {
        const bin = isProbablyBinary(f.bytes);
        return { path: f.path, text: bin || f.bytes.length > LIMITS.maxTextFileBytes ? null : decoder.decode(f.bytes), size: f.bytes.length, mime: mimeOf(f.path), isBinary: bin };
      });
      for (let i = 0; i < batch.length; i += 100) await ingestFiles(p.id, context.userId, batch.slice(i, i + 100));
      await db.from("repository_workspaces").insert({ user_id: context.userId, repository_id: repo.id, project_id: p.id, base_branch: live.default_branch, base_sha: ref.object.sha, status: "IMPORTED" });
      await finalizeProject(p.id, context.userId);
      await db.from("audit_logs").insert({ user_id: context.userId, action: "REPOSITORY_IMPORTED", entity_type: "project", entity_id: p.id, metadata_json: { repo: repo.full_name } });
      return { ok: true, data: { projectId: p.id } };
    } catch (e) {
      const code = errCode(e);
      if (projectId) await db.from("projects").update({ status: "FAILED", error_code: code }).eq("id", projectId);
      return { ok: false, error: code };
    }
  });
