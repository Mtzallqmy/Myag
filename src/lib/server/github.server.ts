// GitHub REST client (server-only). Host is fixed to api.github.com; tokens never leave the server.
import { findSecrets } from "@/lib/security/redact";
import { isProtectedBranch } from "@/lib/agent/policy";

const API = "https://api.github.com";

export class GithubError extends Error {
  constructor(
    public code: string,
    public status?: number,
  ) {
    super(code);
  }
}

export async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "wakeel-agent",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401) throw new GithubError("AUTH_FAILED", 401);
  if (res.status === 403 || res.status === 429) throw new GithubError(res.headers.get("x-ratelimit-remaining") === "0" ? "RATE_LIMITED" : "FORBIDDEN", res.status);
  if (res.status === 404) throw new GithubError("NOT_FOUND", 404);
  if (res.status === 422) throw new GithubError("UNPROCESSABLE", 422);
  if (!res.ok) throw new GithubError(`HTTP_${res.status}`, res.status);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface GhRepo {
  id: number;
  full_name: string;
  default_branch: string;
  private: boolean;
  permissions?: Record<string, boolean>;
  description: string | null;
  pushed_at: string | null;
}

export async function listAllRepos(token: string): Promise<GhRepo[]> {
  const out: GhRepo[] = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await gh<GhRepo[]>(token, `/user/repos?per_page=100&page=${page}&sort=pushed&affiliation=owner,collaborator,organization_member`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

/** Downloads a repository zipball with a hard size cap (no clone URL persisted). */
export async function downloadZipball(token: string, fullName: string, ref: string, maxBytes: number): Promise<Uint8Array> {
  const res = await fetch(`${API}/repos/${fullName}/zipball/${encodeURIComponent(ref)}`, {
    headers: { authorization: `Bearer ${token}`, "user-agent": "wakeel-agent", accept: "application/vnd.github+json" },
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok || !res.body) throw new GithubError(`HTTP_${res.status}`, res.status);
  const finalHost = new URL(res.url).hostname;
  if (!["api.github.com", "codeload.github.com"].includes(finalHost)) throw new GithubError("REDIRECT_BLOCKED");
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new GithubError("ARCHIVE_TOO_LARGE");
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new GithubError("ARCHIVE_TOO_LARGE");
    }
    parts.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    buf.set(p, off);
    off += p.length;
  }
  return buf;
}

export interface PushFile {
  path: string;
  content: string;
}

/** Pre-push checks: branch policy, secret scan, large files. Returns error code or null. */
export function prePushCheck(branch: string, defaultBranch: string, files: PushFile[]): string | null {
  if (isProtectedBranch(branch, defaultBranch)) return "PROTECTED_BRANCH";
  for (const f of files) {
    if (new TextEncoder().encode(f.content).length > 1024 * 1024) return "LARGE_FILE";
    if (findSecrets(f.content).length) return "SECRET_DETECTED";
  }
  return null;
}

/** Creates a single commit on a new agent branch from the default branch. Never force-pushes. */
export async function commitToAgentBranch(
  token: string,
  fullName: string,
  defaultBranch: string,
  branch: string,
  files: PushFile[],
  message: string,
  expectedBaseSha?: string | null,
): Promise<{ commitSha: string; baseSha: string }> {
  const check = prePushCheck(branch, defaultBranch, files);
  if (check) throw new GithubError(check);
  const base = await gh<{ object: { sha: string } }>(token, `/repos/${fullName}/git/ref/heads/${encodeURIComponent(defaultBranch)}`);
  const baseSha = base.object.sha;
  let parentSha = baseSha;
  let branchExists = false;
  try {
    const existing = await gh<{ object: { sha: string } }>(token, `/repos/${fullName}/git/ref/heads/${branch}`);
    branchExists = true;
    parentSha = existing.object.sha;
  } catch (e) {
    if (!(e instanceof GithubError && e.code === "NOT_FOUND")) throw e;
  }
  if (!branchExists && expectedBaseSha && expectedBaseSha !== baseSha) {
    // Remote moved since import: still safe (new branch), but recorded by caller.
  }
  const parent = await gh<{ tree: { sha: string } }>(token, `/repos/${fullName}/git/commits/${parentSha}`);
  const tree = await gh<{ sha: string }>(token, `/repos/${fullName}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: parent.tree.sha,
      tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })),
    }),
  });
  const commit = await gh<{ sha: string }>(token, `/repos/${fullName}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
  });
  if (branchExists) {
    await gh(token, `/repos/${fullName}/git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
  } else {
    await gh(token, `/repos/${fullName}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }) });
  }
  return { commitSha: commit.sha, baseSha };
}
