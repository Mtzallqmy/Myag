// Server-side kill switches, feature flags, quotas, notifications and structured event logging.
// Every check reads the database with the admin client so the browser cannot bypass it.
import { limitsFor, resolveFlag, withinQuota, type FeatureFlag, type KillSwitch, type PlanLimits, type QuotaKey } from "@/lib/policy/plans";
import { redactValue } from "@/lib/security/redact";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Kill switches that imply this one (external_writes covers push + MCP writes). */
const IMPLIED: Partial<Record<KillSwitch, KillSwitch[]>> = {
  disable_github_push: ["disable_external_writes"],
  disable_mcp_writes: ["disable_external_writes"],
};

export async function killSwitchOn(key: KillSwitch, target?: string | null): Promise<boolean> {
  const keys = [key, ...(IMPLIED[key] ?? [])];
  const { data } = await (await db()).from("kill_switches").select("key, enabled, target").in("key", keys);
  return (data ?? []).some((r) => r.enabled && (!r.target || !target || r.target === target));
}

export async function planTier(userId: string): Promise<string> {
  const { data } = await (await db()).from("user_plans").select("tier").eq("user_id", userId).maybeSingle();
  return data?.tier ?? "FREE";
}

export async function flagOn(flag: FeatureFlag, userId: string): Promise<boolean> {
  const [{ data }, tier] = await Promise.all([(await db()).from("feature_flags").select("scope, target, enabled").eq("key", flag), planTier(userId)]);
  return resolveFlag(data ?? [], userId, tier);
}

const dayStart = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

/** Current usage for a quota key. */
export async function quotaUsage(userId: string, key: QuotaKey): Promise<number> {
  const a = await db();
  const since = dayStart();
  switch (key) {
    case "messagesPerDay": {
      const { count } = await a.from("usage_events").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
      return count ?? 0;
    }
    case "tokensPerDay":
    case "providerSpendPerDayUsd": {
      const { data } = await a.from("usage_events").select("input_tokens, output_tokens, estimated_cost").eq("user_id", userId).gte("created_at", since).limit(10000);
      return (data ?? []).reduce((n, r) => n + (key === "tokensPerDay" ? (r.input_tokens ?? 0) + (r.output_tokens ?? 0) : Number(r.estimated_cost ?? 0)), 0);
    }
    case "agentJobsPerDay": {
      const { count } = await a.from("agent_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
      return count ?? 0;
    }
    case "concurrentJobs": {
      const { count } = await a.from("agent_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["PLANNING", "READING", "EDITING", "VERIFYING"]);
      return count ?? 0;
    }
    case "storageBytes": {
      const { data } = await a.from("project_files").select("size_bytes").eq("user_id", userId).limit(50000);
      return (data ?? []).reduce((n, r) => n + (r.size_bytes ?? 0), 0);
    }
    case "mcpServers": {
      const { count } = await a.from("mcp_servers").select("id", { count: "exact", head: true }).eq("user_id", userId);
      return count ?? 0;
    }
    case "repositories": {
      const { count } = await a.from("github_repositories").select("id", { count: "exact", head: true }).eq("user_id", userId);
      return count ?? 0;
    }
  }
}

/** Returns null when allowed, or "QUOTA_EXCEEDED" when one more unit would exceed the plan limit. */
export async function checkQuota(userId: string, key: QuotaKey, adding = 1): Promise<null | "QUOTA_EXCEEDED"> {
  const limits: PlanLimits = limitsFor(await planTier(userId));
  const used = await quotaUsage(userId, key);
  if (withinQuota(used, limits[key], adding)) return null;
  await notify(userId, "USAGE", "QUOTA_EXCEEDED", key);
  return "QUOTA_EXCEEDED";
}

export type NotifyCategory = "APPROVALS" | "JOBS" | "GITHUB" | "INTEGRATIONS" | "USAGE" | "SYSTEM";

/** Titles are i18n codes resolved in the browser; body is short plain text. */
export async function notify(userId: string, category: NotifyCategory, title: string, body?: string, link?: string) {
  await (await db()).from("notifications").insert({ user_id: userId, category, title, body: body?.slice(0, 500) ?? null, link: link ?? null });
}

export interface AppEvent {
  event: string;
  status: "OK" | "FAILED" | "BLOCKED";
  userId?: string | null;
  jobId?: string | null;
  providerId?: string | null;
  modelId?: string | null;
  requestId?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
}

/** Structured event log. Metadata is passed through redactValue — secrets never reach the table. */
export async function logEvent(e: AppEvent) {
  try {
    await (await db()).from("app_events").insert({
      event: e.event,
      status: e.status,
      user_id: e.userId ?? null,
      job_id: e.jobId ?? null,
      provider_id: e.providerId ?? null,
      model_id: e.modelId ?? null,
      request_id: e.requestId ?? crypto.randomUUID(),
      duration_ms: e.durationMs ?? null,
      metadata: (redactValue(e.metadata ?? {}) ?? {}) as never,
    });
  } catch {
    // logging must never break the request
  }
}

/** Staff roles for a user, read through the user's own RLS-scoped client. */
export async function staffRoles(supabase: { from: (t: "user_roles") => any }, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return ((data ?? []) as { role: string }[]).map((r) => r.role);
}
