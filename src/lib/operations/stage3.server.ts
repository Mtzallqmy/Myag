// Stage 3 server functions: access info, memory, global search, usage, and the admin area.
// Admin endpoints authorize roles server-side through the caller's RLS-scoped client, then use the admin client.
import { defineOperation } from "./operation";
import { z } from "zod";
import { FEATURE_FLAGS, KILL_SWITCHES, limitsFor, PLAN_TIERS, resolveFlag, staffCan, STAFF_ROLES, type QuotaKey } from "@/lib/policy/plans";
import { MEMORY_KINDS, MEMORY_TABLE, validateMemoryCandidate } from "@/lib/memory/validate";
import { logEvent, planTier, quotaUsage, staffRoles } from "@/lib/server/guards.server";
import { runtimeConfigured } from "@/lib/server/runtime.server";

type Row = Record<string, string | number | boolean | null>;
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function audit(userId: string, action: string, entityType: string, entityId: string | null, meta: Record<string, unknown> = {}) {
  await (await admin()).from("audit_logs").insert({ user_id: userId, action, entity_type: entityType, entity_id: entityId, metadata_json: meta as never });
}

type Ctx = { supabase: any; userId: string };
async function requireStaff(ctx: Ctx, action: "read" | "audit" | "write" | "roles") {
  const roles = await staffRoles(ctx.supabase, ctx.userId);
  if (!staffCan(roles, action)) {
    await logEvent({ event: "admin_denied", status: "BLOCKED", userId: ctx.userId, metadata: { action } });
    return null;
  }
  return roles;
}

// ---------- access ----------
export const getMyAccess = defineOperation({ method: "GET" })
  .handler(async ({ context }) => {
    const db = await admin();
    const [roles, tier, flags, switches, superCount] = await Promise.all([
      staffRoles(context.supabase, context.userId),
      planTier(context.userId),
      db.from("feature_flags").select("key, scope, target, enabled"),
      db.from("kill_switches").select("key, enabled"),
      db.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "SUPER_ADMIN"),
    ]);
    const resolved = Object.fromEntries(FEATURE_FLAGS.map((f) => [f, resolveFlag((flags.data ?? []).filter((r) => r.key === f), context.userId, tier)]));
    return {
      roles,
      tier,
      flags: resolved as Record<string, boolean>,
      killSwitches: Object.fromEntries((switches.data ?? []).map((s) => [s.key, s.enabled])) as Record<string, boolean>,
      canClaimAdmin: (superCount.count ?? 0) === 0,
      runtimeConfigured: runtimeConfigured(),
    };
  });

/** Bootstrap: the first user may claim SUPER_ADMIN only while none exists. Audited. */
export const claimFirstAdmin = defineOperation({ method: "POST" })
  .handler(async ({ context }): Promise<Result<null>> => {
    const db = await admin();
    const { count } = await db.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "SUPER_ADMIN");
    if ((count ?? 0) > 0) return { ok: false, error: "FORBIDDEN" };
    const { error } = await db.from("user_roles").insert({ user_id: context.userId, role: "SUPER_ADMIN" });
    if (error) return { ok: false, error: "FORBIDDEN" };
    await db.from("user_plans").upsert({ user_id: context.userId, tier: "ADMIN" });
    await audit(context.userId, "SUPER_ADMIN_CLAIMED", "user", context.userId);
    return { ok: true, data: null };
  });

// ---------- memory ----------
export const addMemory = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ kind: z.enum(MEMORY_KINDS), summary: z.string().max(2000), scopeId: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<null>> => {
    const v = validateMemoryCandidate({ kind: data.kind, summary: data.summary, source: "USER", confidence: 1 });
    if (!v.ok) return { ok: false, error: `MEMORY_${v.reason}` };
    const { error } = await (await admin())
      .from(MEMORY_TABLE[data.kind])
      .insert({ user_id: context.userId, scope: data.kind, scope_id: data.scopeId ?? null, source: "USER", summary: v.summary, confidence: v.confidence });
    if (error) return { ok: false, error: "CREATE_FAILED" };
    return { ok: true, data: null };
  });

// ---------- search ----------
export const globalSearch = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ q: z.string().trim().min(2).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const like = `%${data.q.replace(/[%_\\,()]/g, " ")}%`;
    const s = context.supabase;
    const [convos, projects, files, jobs, repos, mcp, providers] = await Promise.all([
      s.from("conversations").select("id, title, updated_at").ilike("title", like).limit(10),
      s.from("projects").select("id, name, status").ilike("name", like).limit(10),
      s.from("project_files").select("project_id, path").ilike("path", like).limit(15),
      s.from("agent_jobs").select("id, request_text, status").ilike("request_text", like).limit(10),
      s.from("github_repositories").select("id, full_name, description").or(`full_name.ilike.${like},description.ilike.${like}`).limit(10),
      s.from("mcp_servers").select("id, name, status").ilike("name", like).limit(10),
      s.from("ai_providers").select("id, name, status").ilike("name", like).limit(10),
    ]);
    return {
      conversations: convos.data ?? [],
      projects: projects.data ?? [],
      files: files.data ?? [],
      jobs: jobs.data ?? [],
      repositories: repos.data ?? [],
      integrations: [...(mcp.data ?? []).map((m: any) => ({ ...m, kind: "mcp" })), ...(providers.data ?? []).map((p: any) => ({ ...p, kind: "provider" }))],
    };
  });

// ---------- usage ----------
export const getUsage = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ days: z.number().int().min(1).max(31) }).parse(d))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const s = context.supabase;
    const [events, jobs, projects, providers, repos, mcp] = await Promise.all([
      s.from("usage_events").select("created_at, input_tokens, output_tokens, estimated_cost, provider_id").gte("created_at", since).limit(20000),
      s.from("agent_jobs").select("id", { count: "exact", head: true }).gte("created_at", since),
      s.from("projects").select("size_bytes"),
      s.from("ai_providers").select("id, name"),
      s.from("github_repositories").select("id", { count: "exact", head: true }),
      s.from("mcp_servers").select("id", { count: "exact", head: true }),
    ]);
    const byDay: Record<string, { requests: number; input: number; output: number; cost: number }> = {};
    const byProvider: Record<string, number> = {};
    for (const e of events.data ?? []) {
      const d = e.created_at.slice(0, 10);
      const b = (byDay[d] ??= { requests: 0, input: 0, output: 0, cost: 0 });
      b.requests++;
      b.input += e.input_tokens ?? 0;
      b.output += e.output_tokens ?? 0;
      b.cost += Number(e.estimated_cost ?? 0);
      if (e.provider_id) byProvider[e.provider_id] = (byProvider[e.provider_id] ?? 0) + 1;
    }
    const tier = await planTier(context.userId);
    const limits = limitsFor(tier);
    const keys: QuotaKey[] = ["messagesPerDay", "tokensPerDay", "agentJobsPerDay", "concurrentJobs", "storageBytes", "providerSpendPerDayUsd", "mcpServers", "repositories"];
    const used = await Promise.all(keys.map((k) => quotaUsage(context.userId, k)));
    const nameOf = Object.fromEntries((providers.data ?? []).map((p: any) => [p.id, p.name]));
    return {
      tier,
      days: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v })),
      providers: Object.entries(byProvider).map(([id, n]) => ({ name: nameOf[id] ?? "—", requests: n })),
      totals: {
        jobs: jobs.count ?? 0,
        storage: (projects.data ?? []).reduce((n: number, p: any) => n + (p.size_bytes ?? 0), 0),
        providers: providers.data?.length ?? 0,
        repositories: repos.count ?? 0,
        mcp: mcp.count ?? 0,
      },
      quotas: keys.map((k, i) => ({ key: k, used: used[i] ?? 0, limit: limits[k] })),
    };
  });

// ---------- admin ----------
const SECTIONS = ["users", "jobs", "providers", "models", "projects", "repositories", "mcp", "usage"] as const;

export const adminOverview = defineOperation({ method: "GET" })
  .handler(async ({ context }): Promise<Result<{ counts: Record<string, number>; roles: string[] }>> => {
    const roles = await requireStaff(context, "read");
    if (!roles) return { ok: false, error: "FORBIDDEN" };
    const db = await admin();
    const tables = ["profiles", "agent_jobs", "ai_providers", "ai_models", "projects", "github_repositories", "mcp_servers", "usage_events"] as const;
    const res = await Promise.all(tables.map((t) => db.from(t).select("id", { count: "exact", head: true })));
    return { ok: true, data: { roles, counts: Object.fromEntries(tables.map((t, i) => [t, res[i]?.count ?? 0])) } };
  });

/** Safe column lists — never select secret refs, tokens or raw payloads. */
export const adminList = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ section: z.enum(SECTIONS) }).parse(d))
  .handler(async ({ data, context }): Promise<Result<Row[]>> => {
    if (!(await requireStaff(context, "read"))) return { ok: false, error: "FORBIDDEN" };
    const db = await admin();
    const q = {
      users: () => db.from("profiles").select("id, display_name, language, created_at").order("created_at", { ascending: false }).limit(200),
      jobs: () => db.from("agent_jobs").select("id, user_id, mode, status, error_code, progress, created_at").order("created_at", { ascending: false }).limit(200),
      providers: () => db.from("ai_providers").select("id, user_id, name, provider_type, status, last_checked_at").order("created_at", { ascending: false }).limit(200),
      models: () => db.from("ai_models").select("id, display_name, external_model_id, status, price_class, context_length").order("updated_at", { ascending: false }).limit(200),
      projects: () => db.from("projects").select("id, user_id, name, status, file_count, size_bytes, created_at").order("created_at", { ascending: false }).limit(200),
      repositories: () => db.from("github_repositories").select("id, user_id, full_name, is_private, status").order("created_at", { ascending: false }).limit(200),
      mcp: () => db.from("mcp_servers").select("id, user_id, name, status, last_error_code, last_checked_at").order("created_at", { ascending: false }).limit(200),
      usage: () => db.from("usage_events").select("user_id, event_type, input_tokens, output_tokens, estimated_cost, created_at").order("created_at", { ascending: false }).limit(200),
    }[data.section];
    const { data: rows, error } = await q();
    if (error) return { ok: false, error: "UNEXPECTED" };
    let out = (rows ?? []) as unknown as Row[];
    if (data.section === "users") {
      const [roles, plans] = await Promise.all([db.from("user_roles").select("user_id, role"), db.from("user_plans").select("user_id, tier")]);
      out = out.map((u) => ({
        ...u,
        roles: (roles.data ?? []).filter((r) => r.user_id === u["id"]).map((r) => r.role).join(", "),
        tier: (plans.data ?? []).find((p) => p.user_id === u["id"])?.tier ?? "FREE",
      }));
    }
    return { ok: true, data: out };
  });

export const adminAudit = defineOperation({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      userId: z.string().uuid().optional(),
      action: z.string().max(80).optional(),
      entity: z.string().max(80).optional(),
      from: z.string().max(30).optional(),
      to: z.string().max(30).optional(),
      status: z.enum(["OK", "FAILED", "BLOCKED"]).optional(),
      risk: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Result<{ audit: Row[]; events: Row[] }>> => {
    if (!(await requireStaff(context, "audit"))) return { ok: false, error: "FORBIDDEN" };
    const db = await admin();
    let a = db.from("audit_logs").select("id, user_id, action, entity_type, entity_id, metadata_json, created_at").order("created_at", { ascending: false }).limit(200);
    let e = db.from("app_events").select("id, user_id, job_id, event, status, duration_ms, model_id, created_at").order("created_at", { ascending: false }).limit(200);
    if (data.userId) {
      a = a.eq("user_id", data.userId);
      e = e.eq("user_id", data.userId);
    }
    if (data.action) a = a.ilike("action", `%${data.action}%`);
    if (data.entity) a = a.eq("entity_type", data.entity);
    if (data.risk) a = a.eq("metadata_json->>risk", data.risk);
    if (data.status) e = e.eq("status", data.status);
    if (data.from) {
      a = a.gte("created_at", data.from);
      e = e.gte("created_at", data.from);
    }
    if (data.to) {
      a = a.lte("created_at", data.to);
      e = e.lte("created_at", data.to);
    }
    const [ar, er] = await Promise.all([a, e]);
    return { ok: true, data: { audit: (ar.data ?? []) as never, events: (er.data ?? []) as never } };
  });

export const adminFlags = defineOperation({ method: "GET" })
  .handler(async ({ context }): Promise<Result<{ flags: Row[]; switches: Row[] }>> => {
    if (!(await requireStaff(context, "read"))) return { ok: false, error: "FORBIDDEN" };
    const db = await admin();
    const [f, k] = await Promise.all([db.from("feature_flags").select("*").order("key"), db.from("kill_switches").select("*").order("key")]);
    return { ok: true, data: { flags: (f.data ?? []) as never, switches: (k.data ?? []) as never } };
  });

export const adminSetFlag = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ key: z.enum(FEATURE_FLAGS), scope: z.enum(["global", "plan", "user"]), target: z.string().max(80).nullable(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<null>> => {
    if (!(await requireStaff(context, "write"))) return { ok: false, error: "FORBIDDEN" };
    if (data.scope === "global" && data.target) return { ok: false, error: "BAD_REQUEST" };
    if (data.scope === "plan" && !(PLAN_TIERS as readonly string[]).includes(data.target ?? "")) return { ok: false, error: "BAD_REQUEST" };
    if (data.scope === "user" && !z.string().uuid().safeParse(data.target).success) return { ok: false, error: "BAD_REQUEST" };
    const db = await admin();
    const target = data.scope === "global" ? null : data.target;
    const existing = await db.from("feature_flags").select("id").eq("key", data.key).eq("scope", data.scope).filter("target", target ? "eq" : "is", target ?? null).maybeSingle();
    if (existing.data) await db.from("feature_flags").update({ enabled: data.enabled, updated_by: context.userId, updated_at: new Date().toISOString() }).eq("id", existing.data.id);
    else await db.from("feature_flags").insert({ key: data.key, scope: data.scope, target, enabled: data.enabled, updated_by: context.userId });
    await audit(context.userId, "FEATURE_FLAG_SET", "feature_flag", null, { ...data });
    return { ok: true, data: null };
  });

export const adminSetKillSwitch = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ key: z.enum(KILL_SWITCHES), enabled: z.boolean(), target: z.string().uuid().nullable().optional(), reason: z.string().max(300).optional() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<null>> => {
    if (!(await requireStaff(context, "write"))) return { ok: false, error: "FORBIDDEN" };
    await (await admin())
      .from("kill_switches")
      .update({ enabled: data.enabled, target: data.target ?? null, reason: data.reason ?? null, updated_by: context.userId, updated_at: new Date().toISOString() })
      .eq("key", data.key);
    await audit(context.userId, "KILL_SWITCH_SET", "kill_switch", null, { ...data, risk: "HIGH" });
    await logEvent({ event: "kill_switch", status: "OK", userId: context.userId, metadata: { key: data.key, enabled: data.enabled } });
    return { ok: true, data: null };
  });

export const adminSetPlan = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ userId: z.string().uuid(), tier: z.enum(PLAN_TIERS) }).parse(d))
  .handler(async ({ data, context }): Promise<Result<null>> => {
    if (!(await requireStaff(context, "write"))) return { ok: false, error: "FORBIDDEN" };
    await (await admin()).from("user_plans").upsert({ user_id: data.userId, tier: data.tier, updated_at: new Date().toISOString() });
    await audit(context.userId, "PLAN_SET", "user", data.userId, { tier: data.tier });
    return { ok: true, data: null };
  });

export const adminSetRole = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: z.enum(STAFF_ROLES), grant: z.boolean() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<null>> => {
    if (!(await requireStaff(context, "roles"))) return { ok: false, error: "FORBIDDEN" };
    if (!data.grant && data.userId === context.userId && data.role === "SUPER_ADMIN") return { ok: false, error: "CANNOT_REMOVE_SELF" };
    const db = await admin();
    if (data.grant) await db.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    else await db.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    await audit(context.userId, data.grant ? "ROLE_GRANTED" : "ROLE_REVOKED", "user", data.userId, { role: data.role, risk: "HIGH" });
    return { ok: true, data: null };
  });

export const adminHealth = defineOperation({ method: "GET" })
  .handler(async ({ context }) => {
    if (!(await requireStaff(context, "read"))) return { ok: false as const, error: "FORBIDDEN" };
    const db = await admin();
    const t0 = Date.now();
    const ping = await db.from("profiles").select("id", { count: "exact", head: true });
    const dbMs = Date.now() - t0;
    const since = new Date(Date.now() - 86400_000).toISOString();
    const [prov, gh, mcp, failures] = await Promise.all([
      db.from("ai_providers").select("status"),
      db.from("github_connections").select("status"),
      db.from("mcp_servers").select("status"),
      db.from("agent_jobs").select("id, error_code, created_at").eq("status", "FAILED").gte("created_at", since).order("created_at", { ascending: false }).limit(20),
    ]);
    const tally = (rows: { status: string | null }[] | null) => (rows ?? []).reduce<Record<string, number>>((m, r) => ((m[r.status ?? "UNKNOWN"] = (m[r.status ?? "UNKNOWN"] ?? 0) + 1), m), {});
    return {
      ok: true as const,
      data: {
        database: { ok: !ping.error, latencyMs: dbMs },
        runtime: { configured: runtimeConfigured() },
        providers: tally(prov.data),
        github: tally(gh.data as never),
        mcp: tally(mcp.data),
        recentFailures: failures.data ?? [],
      },
    };
  });
