import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { notificationsQuery, qk3 } from "@/lib/queries3";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "الإشعارات — وكيل" },
      { name: "description", content: "مركز إشعارات الموافقات والمهام والتكاملات والاستخدام." },
      { property: "og:title", content: "الإشعارات — وكيل" },
      { property: "og:description", content: "إشعارات لحظية داخل التطبيق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

const CATS = ["APPROVALS", "JOBS", "GITHUB", "INTEGRATIONS", "USAGE", "SYSTEM"] as const;

function NotificationsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const q = useQuery(notificationsQuery);
  const [cat, setCat] = useState<string | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk3.notifications });
    qc.invalidateQueries({ queryKey: qk3.unread });
  };
  const markAll = async () => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    refresh();
  };
  const markOne = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    refresh();
  };
  const rows = (q.data ?? []).filter((n) => !cat || n.category === cat);

  return (
    <>
      <PageHeader title={t.notif.title} actions={<Button variant="outline" onClick={markAll}>{t.notif.markAll}</Button>} />
      <PageBody className="space-y-4">
        <div className="flex flex-wrap gap-2" role="tablist">
          {[null, ...CATS].map((c) => (
            <button
              key={c ?? "all"}
              role="tab"
              aria-selected={cat === c}
              onClick={() => setCat(c)}
              className={cn("min-h-10 rounded-full border px-4 text-sm", cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}
            >
              {c ? t.notif.cat[c] : t.notif.all}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{t.notif.pushNote}</p>
        {q.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !rows.length ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">{t.notif.empty}</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((n) => {
              const inner = (
                <div className={cn("rounded-xl border bg-card p-4", n.read_at ? "border-border" : "border-primary")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{!n.read_at && <span className="sr-only">●</span>}{t.notif.t[n.title] ?? n.title}</span>
                    <span className="text-xs text-muted-foreground">{t.notif.cat[n.category]}</span>
                  </div>
                  {n.body && <p className="mt-1 break-words text-sm text-muted-foreground">{t.errors[n.body] ?? t.usage.q[n.body] ?? n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString(lang)}</p>
                </div>
              );
              const safe = n.link && n.link.startsWith("/tasks/") ? n.link.slice(7) : null;
              return (
                <li key={n.id} onClick={() => !n.read_at && markOne(n.id)}>
                  {safe ? <Link to="/tasks/$id" params={{ id: safe }}>{inner}</Link> : inner}
                </li>
              );
            })}
          </ul>
        )}
      </PageBody>
    </>
  );
}
