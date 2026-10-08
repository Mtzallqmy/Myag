// Server-enforced tool policy. The model never calls server functions directly:
// it proposes actions that are mapped onto these tools and checked here.
import { z } from "zod";

export const AGENT_MODES = ["READ_ONLY", "SUGGEST", "WORKSPACE"] as const;
export type AgentMode = (typeof AGENT_MODES)[number];
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const modeRank: Record<AgentMode, number> = { READ_ONLY: 0, SUGGEST: 1, WORKSPACE: 2 };

export interface ToolDef {
  risk: RiskLevel;
  minMode: AgentMode;
  approval: boolean;
  schema: z.ZodTypeAny;
}

const path = z.string().min(1).max(1024);
const uuid = z.string().uuid();

export const TOOLS = {
  "project.search": { risk: "LOW", minMode: "READ_ONLY", approval: false, schema: z.object({ query: z.string().min(1).max(200) }) },
  "project.read_file": { risk: "LOW", minMode: "READ_ONLY", approval: false, schema: z.object({ path }) },
  "project.diff": { risk: "LOW", minMode: "READ_ONLY", approval: false, schema: z.object({ changeSetId: uuid }) },
  "project.propose_patch": {
    risk: "LOW",
    minMode: "SUGGEST",
    approval: false,
    schema: z.object({ files: z.array(z.object({ path, content: z.string().max(400_000) })).min(1).max(5) }),
  },
  "project.apply_patch": { risk: "MEDIUM", minMode: "WORKSPACE", approval: true, schema: z.object({ changeSetId: uuid }) },
  "validation.run": { risk: "MEDIUM", minMode: "WORKSPACE", approval: false, schema: z.object({ jobId: uuid }) },
  "github.read_issue": { risk: "LOW", minMode: "READ_ONLY", approval: false, schema: z.object({ repositoryId: uuid, number: z.number().int().positive() }) },
  "github.create_branch": { risk: "MEDIUM", minMode: "WORKSPACE", approval: true, schema: z.object({ changeSetId: uuid }) },
  "github.commit": { risk: "HIGH", minMode: "WORKSPACE", approval: true, schema: z.object({ changeSetId: uuid }) },
  "github.push": { risk: "HIGH", minMode: "WORKSPACE", approval: true, schema: z.object({ changeSetId: uuid }) },
  "github.create_pr": {
    risk: "HIGH",
    minMode: "WORKSPACE",
    approval: true,
    schema: z.object({ changeSetId: uuid, title: z.string().min(1).max(200), body: z.string().max(20_000) }),
  },
  "mcp.call_tool": { risk: "HIGH", minMode: "WORKSPACE", approval: true, schema: z.object({ toolId: uuid, args: z.record(z.unknown()) }) },
} satisfies Record<string, ToolDef>;

export type ToolName = keyof typeof TOOLS;

export type PolicyDecision = { allowed: true; approval: boolean; risk: RiskLevel } | { allowed: false; reason: string };

export function checkTool(tool: string, mode: AgentMode, input: unknown): PolicyDecision {
  const def = (TOOLS as Record<string, ToolDef>)[tool];
  if (!def) return { allowed: false, reason: "UNKNOWN_TOOL" };
  if (modeRank[mode] < modeRank[def.minMode]) return { allowed: false, reason: "MODE_FORBIDS_TOOL" };
  if (!def.schema.safeParse(input).success) return { allowed: false, reason: "INVALID_TOOL_INPUT" };
  return { allowed: true, approval: def.approval, risk: def.risk };
}

/** Approval is executable only if approved, unexecuted, and decided before expiry. */
export function approvalExecutable(a: { status: string; expires_at: string; decided_at: string | null; executed_at: string | null }, now = new Date()): boolean {
  if (a.status !== "APPROVED" || a.executed_at || !a.decided_at) return false;
  const exp = new Date(a.expires_at).getTime();
  return new Date(a.decided_at).getTime() <= exp && now.getTime() <= exp + 10 * 60_000;
}

export const MAX_JOB_STEPS = 10;
export const MAX_FILES_PER_PATCH = 5;

/** Classifies MCP tools by name/description keywords. Unknown defaults to HIGH. */
export function classifyMcpTool(name: string, description = ""): RiskLevel {
  const s = `${name} ${description}`.toLowerCase();
  if (/(secret|credential|password|shell|exec|execute|command|terminal|deploy|production|privilege|grant|role|drop|truncate|delete_account|account deletion|destroy)/.test(s))
    return "CRITICAL";
  if (/(send|create|update|write|delete|remove|post|put|patch|trigger|publish|merge|push|upload|insert)/.test(name.toLowerCase())) return "HIGH";
  if (/(draft|temp|preview|format)/.test(name.toLowerCase())) return "MEDIUM";
  if (/^(get|list|read|search|find|fetch|query|describe|show|lookup|view)[_\-.]?/.test(name.toLowerCase())) return "LOW";
  return "HIGH";
}

export function defaultToolState(risk: RiskLevel): { enabled: boolean; approval_required: boolean } {
  switch (risk) {
    case "LOW":
      return { enabled: true, approval_required: false };
    case "MEDIUM":
      return { enabled: false, approval_required: true };
    case "HIGH":
      return { enabled: false, approval_required: true };
    default:
      return { enabled: false, approval_required: true };
  }
}

/** Branch policy: agent branches only, never default/main/master. */
export function agentBranchName(task: string, shortId: string): string {
  const slug =
    task
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "task";
  return `agent/${slug}-${shortId.slice(0, 8)}`;
}

export function isProtectedBranch(branch: string, defaultBranch: string): boolean {
  return branch === defaultBranch || ["main", "master", "develop", "production", "release"].includes(branch) || !branch.startsWith("agent/");
}
