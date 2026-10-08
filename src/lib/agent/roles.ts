// Bounded role-based multi-agent definitions. Roles run in a fixed pipeline — never agent-to-agent chat.
import type { ToolName } from "./policy";
import type { RoutingMode } from "@/lib/ai/types";

export const AGENT_ROLES = ["COORDINATOR", "CODE_ANALYSIS", "IMPLEMENTATION", "REVIEW", "TESTING", "SECURITY_REVIEW", "DOCUMENTATION", "INTEGRATION"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export interface RoleDef {
  purpose: string;
  tools: readonly ToolName[];
  routing: RoutingMode;
  stepLimit: number;
  /** Keys of the structured result the role must return. */
  result: readonly string[];
}

export const ROLE_DEFS: Record<AgentRole, RoleDef> = {
  COORDINATOR: { purpose: "Split the request into role tasks and merge results", tools: [], routing: "PREFER_STRONGEST", stepLimit: 1, result: ["plan", "roles"] },
  CODE_ANALYSIS: { purpose: "Find relevant files and explain current behavior", tools: ["project.search", "project.read_file"], routing: "PREFER_LONG_CONTEXT", stepLimit: 2, result: ["files", "findings"] },
  IMPLEMENTATION: { purpose: "Propose a minimal patch", tools: ["project.read_file", "project.propose_patch"], routing: "PREFER_CODING", stepLimit: 2, result: ["files", "summary"] },
  REVIEW: { purpose: "Check the patch for correctness and scope", tools: [], routing: "PREFER_STRONGEST", stepLimit: 1, result: ["issues", "verdict"] },
  TESTING: { purpose: "Request validation runs (only when runtime is configured)", tools: ["validation.run"], routing: "PREFER_FAST", stepLimit: 1, result: ["status"] },
  SECURITY_REVIEW: { purpose: "Look for secrets, injection, unsafe patterns", tools: [], routing: "PREFER_STRONGEST", stepLimit: 1, result: ["issues", "verdict"] },
  DOCUMENTATION: { purpose: "Summarize the change for humans", tools: [], routing: "PREFER_CHEAP", stepLimit: 1, result: ["summary"] },
  INTEGRATION: { purpose: "Prepare branch/PR actions — always via approval", tools: ["github.create_branch", "github.push", "github.create_pr"], routing: "PREFER_FAST", stepLimit: 1, result: ["actions"] },
};

/** Hard cap on total role steps per job. */
export const MAX_ORCHESTRATION_STEPS = 10;

export type AgentDepth = "FAST" | "BALANCED" | "DEEP" | "MULTI";

/** Fixed pipelines per depth. Total steps never exceed MAX_ORCHESTRATION_STEPS. */
export function pipelineFor(depth: AgentDepth): AgentRole[] {
  switch (depth) {
    case "FAST":
      return ["IMPLEMENTATION"];
    case "BALANCED":
      return ["CODE_ANALYSIS", "IMPLEMENTATION"];
    case "DEEP":
      return ["CODE_ANALYSIS", "IMPLEMENTATION", "REVIEW"];
    case "MULTI":
      return ["COORDINATOR", "CODE_ANALYSIS", "IMPLEMENTATION", "REVIEW", "SECURITY_REVIEW", "TESTING", "DOCUMENTATION"];
  }
}

export function pipelineSteps(depth: AgentDepth): number {
  return pipelineFor(depth).reduce((n, r) => n + ROLE_DEFS[r].stepLimit, 0);
}

/** Map persisted job step types to the role that produced them (for progress display). */
export function roleForStep(stepType: string): AgentRole | null {
  const m: Record<string, AgentRole> = {
    PLAN: "COORDINATOR",
    RETRIEVE: "CODE_ANALYSIS",
    READ: "CODE_ANALYSIS",
    PATCH: "IMPLEMENTATION",
    REVIEW: "REVIEW",
    SECURITY: "SECURITY_REVIEW",
    VALIDATE: "TESTING",
    SUMMARY: "DOCUMENTATION",
    GIT: "INTEGRATION",
  };
  return m[stepType] ?? null;
}
