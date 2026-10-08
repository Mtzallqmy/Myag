import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const tone: Record<string, string> = {
  ONLINE: "bg-success/12 text-success border-success/30",
  DEGRADED: "bg-warning/15 text-warning-foreground dark:text-warning border-warning/40",
  RATE_LIMITED: "bg-warning/15 text-warning-foreground dark:text-warning border-warning/40",
  CHECKING: "bg-info/12 text-info border-info/30",
  AUTH_FAILED: "bg-destructive/12 text-destructive border-destructive/30",
  OFFLINE: "bg-destructive/12 text-destructive border-destructive/30",
  INVALID_RESPONSE: "bg-destructive/12 text-destructive border-destructive/30",
  FAILED: "bg-destructive/12 text-destructive border-destructive/30",
  DISABLED: "bg-muted text-muted-foreground border-border",
  UNKNOWN: "bg-muted text-muted-foreground border-border",
};

export function StatusChip({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  const label = (t.status as Record<string, string>)[status] ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone[status] ?? tone["UNKNOWN"],
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          status === "CHECKING" && "animate-pulse",
        )}
      />
      {label}
    </span>
  );
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border border-border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
