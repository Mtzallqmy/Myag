import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNewChat } from "@/components/app/hooks";
import { supabase } from "@/integrations/supabase/client";
import { conversationsQuery, qk } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/chats/")({
  head: () => ({
    meta: [
      { title: "المحادثات — وكيل" },
      { name: "description", content: "كل محادثاتك البرمجية مع الوكيل." },
      { property: "og:title", content: "المحادثات — وكيل" },
      { property: "og:description", content: "قائمة المحادثات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatsPage,
});

function ChatsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const convos = useQuery(conversationsQuery);
  const newChat = useNewChat();

  // Realtime: keep the list fresh when titles/updates land from the server.
  useEffect(() => {
    const ch = supabase
      .channel("conversations-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () =>
        qc.invalidateQueries({ queryKey: qk.conversations }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  async function remove(id: string) {
    if (!confirm(t.chat.deleteConfirm)) return;
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) toast.error(t.common.error);
    qc.invalidateQueries({ queryKey: qk.conversations });
  }

  return (
    <>
      <PageHeader
        title={t.chat.title}
        actions={
          <Button onClick={() => newChat.mutate()} disabled={newChat.isPending}>
            <MessageSquarePlus className="size-4" />
            {t.chat.new}
          </Button>
        }
      />
      <PageBody>
        {convos.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !convos.data?.length ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="mb-4 text-muted-foreground">{t.chat.empty}</p>
            <Button onClick={() => newChat.mutate()}>{t.chat.new}</Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {convos.data.map((c) => (
              <li key={c.id} className="group flex items-center gap-2 rounded-xl border border-border bg-card">
                <Link to="/chats/$id" params={{ id: c.id }} className="min-w-0 flex-1 px-4 py-3.5">
                  <div className="truncate font-medium" dir="auto">
                    {c.title || t.chat.untitled}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t.routing[c.routing_mode as keyof typeof t.routing] as string} ·{" "}
                    {new Date(c.updated_at).toLocaleString(lang === "ar" ? "ar" : "en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </Link>
                <Button variant="ghost" size="icon" className="me-2 text-muted-foreground" onClick={() => remove(c.id)} aria-label={t.common.delete}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}
