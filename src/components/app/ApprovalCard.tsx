import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decideApproval } from "@/lib/agent.functions";
import type { Approval } from "@/lib/queries2";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const riskTone: Record<string, string> = {
  LOW: "text-success",
  MEDIUM: "text-warning-foreground dark:text-warning",
  HIGH: "text-destructive",
  CRITICAL: "text-destructive font-bold",
};

export function ApprovalCard({ a, onDone, detailsHref }: { a: Approval; onDone?: () => void; detailsHref?: React.ReactNode }) {
  const { t, lang, errorText } = useI18n();
  const qc = useQueryClient();
  const decide = useServerFn(decideApproval);
  const [busy, setBusy] = useState<null | "APPROVE" | "REJECT">(null);
  const expired = new Date(a.expires_at) < new Date();
  const n = ((a.payload_json as { files?: string[] })?.files ?? []).length || Number(a.summary) || 0;
  const op = (t.approval.actions[a.action_type] ?? a.action_type).replace("{n}", String(n));

  async function go(decision: "APPROVE" | "REJECT") {
    setBusy(decision);
    const r = await decide({ data: { approvalId: a.id, decision } }).catch(() => ({ ok: false as const, error: "UNEXPECTED" }));
    setBusy(null);
    qc.invalidateQueries();
    if (!r.ok) toast.error(errorText(r.error));
    else toast.success(t.approval.status[decision === "APPROVE" ? "APPROVED" : "REJECTED"]);
    onDone?.();
  }

  return (
    <div className="rounded-xl border-2 border-warning/50 bg-warning/5 p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold">
        <ShieldAlert className="size-5 text-warning-foreground dark:text-warning" />
        {t.approval.title}
      </div>
      <dl className="space-y-1.5 text-[15px]">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{t.approval.operation}:</dt>
          <dd className="font-medium">{op}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{t.approval.risk}:</dt>
          <dd className={cn("font-medium", riskTone[a.risk_level])}>{t.approval.risks[a.risk_level] ?? a.risk_level}</dd>
        </div>
        <div className="flex gap-2 text-sm">
          <dt className="text-muted-foreground">{t.approval.expires}:</dt>
          <dd className={expired ? "text-destructive" : ""}>
            {expired ? t.approval.expired : new Date(a.expires_at).toLocaleTimeString(lang === "ar" ? "ar" : "en", { timeStyle: "short" })}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => go("APPROVE")} disabled={!!busy || expired}>
          {busy === "APPROVE" && <Loader2 className="size-4 animate-spin" />}
          {t.approval.approve}
        </Button>
        <Button variant="outline" onClick={() => go("REJECT")} disabled={!!busy}>
          {busy === "REJECT" && <Loader2 className="size-4 animate-spin" />}
          {t.approval.reject}
        </Button>
        {detailsHref}
      </div>
    </div>
  );
}

export function JobStatus({ status }: { status: string }) {
  const { t } = useI18n();
  const tone =
    status === "COMPLETED"
      ? "bg-success/12 text-success border-success/30"
      : status === "FAILED"
        ? "bg-destructive/12 text-destructive border-destructive/30"
        : status === "CANCELLED"
          ? "bg-muted text-muted-foreground border-border"
          : status === "AWAITING_APPROVAL"
            ? "bg-warning/15 text-warning-foreground dark:text-warning border-warning/40"
            : "bg-info/12 text-info border-info/30";
  const running = !["COMPLETED", "FAILED", "CANCELLED", "AWAITING_APPROVAL"].includes(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", tone)}>
      <span className={cn("size-1.5 rounded-full bg-current", running && "animate-pulse")} />
      {t.jobs.status[status] ?? status}
    </span>
  );
}
