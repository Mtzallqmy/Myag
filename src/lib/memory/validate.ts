// Validates memory candidates. Raw model output never becomes memory without passing here.
import { findSecrets } from "@/lib/security/redact";

export const MEMORY_KINDS = ["conversation", "project", "preferences", "task"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];
export const MEMORY_TABLE: Record<MemoryKind, "conversation_memory" | "project_memory" | "user_preferences_memory" | "task_memory"> = {
  conversation: "conversation_memory",
  project: "project_memory",
  preferences: "user_preferences_memory",
  task: "task_memory",
};

const SENSITIVE = /(password|passwd|كلمة\s*(السر|المرور)|api[\s_-]?key|secret|token|bearer|private[\s_-]?key|authorization:|BEGIN [A-Z ]*PRIVATE KEY)/i;

export interface MemoryCandidate {
  kind: MemoryKind;
  summary: string;
  source: "USER" | "AGENT_SUMMARY";
  confidence: number;
}

export type MemoryVerdict = { ok: true; summary: string; confidence: number } | { ok: false; reason: "EMPTY" | "TOO_LONG" | "SECRET" | "LOW_CONFIDENCE" };

export function validateMemoryCandidate(c: MemoryCandidate): MemoryVerdict {
  const s = c.summary.replace(/\s+/g, " ").trim();
  if (s.length < 3) return { ok: false, reason: "EMPTY" };
  if (s.length > 500) return { ok: false, reason: "TOO_LONG" };
  if (SENSITIVE.test(s) || findSecrets(s).length > 0) return { ok: false, reason: "SECRET" };
  // Model-derived candidates need a minimum confidence; explicit user entries are trusted.
  const confidence = c.source === "USER" ? 1 : Math.max(0, Math.min(1, c.confidence));
  if (c.source !== "USER" && confidence < 0.6) return { ok: false, reason: "LOW_CONFIDENCE" };
  return { ok: true, summary: s, confidence };
}
