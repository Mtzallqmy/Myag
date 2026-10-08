import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ProjectStatus({ status }: { status: string }) {
  const { t } = useI18n();
  const tone =
    status === "READY" ? "bg-success/12 text-success border-success/30" : status === "FAILED" ? "bg-destructive/12 text-destructive border-destructive/30" : "bg-info/12 text-info border-info/30";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", tone)}>
      <span className={cn("size-1.5 rounded-full bg-current", status !== "READY" && status !== "FAILED" && "animate-pulse")} />
      {t.projects.status[status] ?? status}
    </span>
  );
}

