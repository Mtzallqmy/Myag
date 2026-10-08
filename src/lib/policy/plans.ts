// Plan tiers and quota limits. Single source of truth — enforced server-side in guards.server.ts.
export const PLAN_TIERS = ["FREE", "STANDARD", "PRO", "ADMIN"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export interface PlanLimits {
  messagesPerDay: number;
  tokensPerDay: number;
  agentJobsPerDay: number;
  concurrentJobs: number;
  storageBytes: number;
  providerSpendPerDayUsd: number;
  mcpServers: number;
  repositories: number;
}

const MB = 1024 * 1024;

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  FREE: { messagesPerDay: 200, tokensPerDay: 400_000, agentJobsPerDay: 20, concurrentJobs: 1, storageBytes: 200 * MB, providerSpendPerDayUsd: 2, mcpServers: 3, repositories: 20 },
  STANDARD: { messagesPerDay: 1000, tokensPerDay: 2_000_000, agentJobsPerDay: 100, concurrentJobs: 2, storageBytes: 1024 * MB, providerSpendPerDayUsd: 10, mcpServers: 10, repositories: 100 },
  PRO: { messagesPerDay: 5000, tokensPerDay: 10_000_000, agentJobsPerDay: 500, concurrentJobs: 4, storageBytes: 5120 * MB, providerSpendPerDayUsd: 50, mcpServers: 25, repositories: 500 },
  ADMIN: { messagesPerDay: 20000, tokensPerDay: 50_000_000, agentJobsPerDay: 2000, concurrentJobs: 8, storageBytes: 20480 * MB, providerSpendPerDayUsd: 200, mcpServers: 50, repositories: 2000 },
};

export type QuotaKey = keyof PlanLimits;

export function limitsFor(tier: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(PLAN_TIERS as readonly string[]).includes(tier ?? "") ? (tier as PlanTier) : "FREE"];
}

/** Pure check: returns true when one more unit would stay within the limit. */
export function withinQuota(used: number, limit: number, adding = 1): boolean {
  return used + adding <= limit;
}

export const FEATURE_FLAGS = ["multi_agent", "deep_mode", "github_push", "mcp_write_tools", "new_provider_adapter", "experimental_router", "runtime_execution"] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export const KILL_SWITCHES = ["disable_new_agent_jobs", "disable_external_writes", "disable_github_push", "disable_mcp_writes", "disable_uploads", "disable_provider"] as const;
export type KillSwitch = (typeof KILL_SWITCHES)[number];

export const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "SUPPORT", "AUDITOR", "READ_ONLY"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** What each staff role may do. Read = view admin data; write = flags/switches/plans; roles = grant roles. */
export function staffCan(roles: readonly string[], action: "read" | "audit" | "write" | "roles"): boolean {
  const has = (r: StaffRole) => roles.includes(r);
  switch (action) {
    case "read":
      return roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
    case "audit":
      return has("SUPER_ADMIN") || has("ADMIN") || has("AUDITOR");
    case "write":
      return has("SUPER_ADMIN") || has("ADMIN");
    case "roles":
      return has("SUPER_ADMIN");
  }
}

/** Resolve a flag: user scope beats plan scope beats global. */
export function resolveFlag(rows: { scope: string; target: string | null; enabled: boolean }[], userId: string, tier: string): boolean {
  const u = rows.find((r) => r.scope === "user" && r.target === userId);
  if (u) return u.enabled;
  const p = rows.find((r) => r.scope === "plan" && r.target === tier);
  if (p) return p.enabled;
  return rows.find((r) => r.scope === "global")?.enabled ?? false;
}
