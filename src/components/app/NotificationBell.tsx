import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { unreadCountQuery, qk3 } from "@/lib/queries3";
import { useI18n } from "@/lib/i18n";

/** Header bell with live unread count (Realtime on the user's own notifications, RLS-scoped). */
export function NotificationBell() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: count = 0 } = useQuery(unreadCountQuery);

  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      ch = supabase
        .channel(`notif-${data.user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${data.user.id}` }, () => {
          qc.invalidateQueries({ queryKey: qk3.notifications });
          qc.invalidateQueries({ queryKey: qk3.unread });
        })
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (ch) supabase.removeChannel(ch);
    };
  }, [qc]);

  return (
    <Link
      to="/notifications"
      aria-label={`${t.nav3.notifications}${count ? ` (${count})` : ""}`}
      className="relative inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Bell className="size-5" />
      {count > 0 && (
        <span className="absolute end-1.5 top-1.5 min-w-5 rounded-full bg-primary px-1 text-center text-[11px] font-bold leading-5 text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
