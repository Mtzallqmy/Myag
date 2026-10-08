import { describe, expect, it } from "vitest";
import { limitsFor, resolveFlag, staffCan, withinQuota } from "@/lib/policy/plans";
import { validateMemoryCandidate } from "@/lib/memory/validate";
import { MAX_ORCHESTRATION_STEPS, pipelineFor, pipelineSteps } from "@/lib/agent/roles";
import { MAX_JOB_STEPS } from "@/lib/agent/policy";

describe("quotas", () => {
  it("unknown tier falls back to FREE", () => expect(limitsFor("HACKER")).toEqual(limitsFor("FREE")));
  it("blocks at the limit", () => {
    expect(withinQuota(19, 20)).toBe(true);
    expect(withinQuota(20, 20)).toBe(false);
  });
});

describe("feature flags", () => {
  const rows = [
    { scope: "global", target: null, enabled: false },
    { scope: "plan", target: "PRO", enabled: true },
    { scope: "user", target: "u1", enabled: false },
  ];
  it("user beats plan beats global", () => {
    expect(resolveFlag(rows, "u1", "PRO")).toBe(false);
    expect(resolveFlag(rows, "u2", "PRO")).toBe(true);
    expect(resolveFlag(rows, "u2", "FREE")).toBe(false);
  });
});

describe("admin RBAC", () => {
  it("normal users have no access", () => expect(staffCan([], "read")).toBe(false));
  it("auditor can audit but not write", () => {
    expect(staffCan(["AUDITOR"], "audit")).toBe(true);
    expect(staffCan(["AUDITOR"], "write")).toBe(false);
  });
  it("only super admin grants roles", () => {
    expect(staffCan(["ADMIN"], "roles")).toBe(false);
    expect(staffCan(["SUPER_ADMIN"], "roles")).toBe(true);
  });
  it("read-only cannot write", () => expect(staffCan(["READ_ONLY"], "write")).toBe(false));
});

describe("memory validation", () => {
  it("rejects secrets", () => {
    expect(validateMemoryCandidate({ kind: "preferences", summary: "my password is hunter2", source: "USER", confidence: 1 }).ok).toBe(false);
    expect(validateMemoryCandidate({ kind: "preferences", summary: "key sk-abcdefghijklmnopqrstuvwxyz123456", source: "USER", confidence: 1 }).ok).toBe(false);
  });
  it("rejects low-confidence model output", () =>
    expect(validateMemoryCandidate({ kind: "task", summary: "Prefers TypeScript", source: "AGENT_SUMMARY", confidence: 0.3 })).toEqual({ ok: false, reason: "LOW_CONFIDENCE" }));
  it("accepts a normal preference", () => expect(validateMemoryCandidate({ kind: "preferences", summary: "أفضّل الردود القصيرة", source: "USER", confidence: 1 }).ok).toBe(true));
});

describe("multi-agent bounds", () => {
  it("every pipeline fits within the step caps", () => {
    for (const d of ["FAST", "BALANCED", "DEEP", "MULTI"] as const) {
      expect(pipelineSteps(d)).toBeLessThanOrEqual(MAX_ORCHESTRATION_STEPS);
      expect(new Set(pipelineFor(d)).size).toBe(pipelineFor(d).length);
    }
    expect(MAX_JOB_STEPS).toBeLessThanOrEqual(MAX_ORCHESTRATION_STEPS);
  });
});
