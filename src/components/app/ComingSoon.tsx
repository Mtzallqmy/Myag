import type { LucideIcon } from "lucide-react";
import { PageBody, PageHeader } from "./AppShell";
import { useI18n } from "@/lib/i18n";

export function ComingSoon({ title, body, icon: Icon }: { title: string; body: string; icon: LucideIcon }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={title} />
      <PageBody>
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Icon className="size-7" />
          </div>
          <span className="mb-3 rounded-full border border-border px-3 py-0.5 text-xs font-medium text-muted-foreground">
            {t.common.comingSoon}
          </span>
          <p className="max-w-md text-lg text-muted-foreground">{body}</p>
        </div>
      </PageBody>
    </>
  );
}
