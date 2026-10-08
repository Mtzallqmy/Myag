import { Check, Circle, MinusCircle } from "lucide-react";
import { roleForStep, type AgentRole } from "@/lib/agent/roles";
import { useI18n } from "@/lib/i18n";

/** Operational role progress only — no hidden reasoning is shown. */
export function RoleProgress({ orchestration, steps }: { orchestration: unknown; steps: { step_type: string; summary: string | null }[] }) {
  const { t } = useI18n();
  const o = orchestration as { depth?: string; roles?: AgentRole[] } | null;
  if (!o?.roles?.length) return null;
  const done = new Map<AgentRole, string>();
  for (const s of steps) {
    const r = roleForStep(s.step_type);
    if (r) done.set(r, s.summary ?? "");
  }
  // Implementation is marked done by PROPOSE/ANSWER steps too.
  if (steps.some((s) => s.step_type === "PROPOSE" || s.step_type === "ANSWER")) done.set("IMPLEMENTATION", done.get("IMPLEMENTATION") ?? "");
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        {t.roles["title"]} · {o.depth ? t.depth[o.depth as "FAST"] : ""}
      </h2>
      <ol className="space-y-2">
        {o.roles.map((r) => {
          const summary = done.get(r);
          const unavailable = summary === "RUNTIME_UNAVAILABLE";
          const isDone = summary !== undefined && !unavailable;
          const Icon = unavailable ? MinusCircle : isDone ? Check : Circle;
          return (
            <li key={r} className="flex items-center gap-3">
              <Icon className={isDone ? "size-5 text-primary" : "size-5 text-muted-foreground"} aria-hidden />
              <span className="flex-1">{t.roles[r]}</span>
              <span className="text-sm text-muted-foreground">{unavailable ? t.roles["skipped"] : isDone ? t.roles["done"] : t.roles["pending"]}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
