import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Boxes, MessageSquarePlus, Server, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { PageBody } from "@/components/app/AppShell";
import { StatusChip } from "@/components/app/StatusChip";
import { Skeleton } from "@/components/ui/skeleton";
import { useNewChat } from "@/components/app/hooks";
import { conversationsQuery, modelsQuery, profileQuery, providersQuery, routingQuery } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "الرئيسية — وكيل" },
      { name: "description", content: "نظرة عامة على التوجيه وحالة المزودات وآخر المحادثات." },
      { property: "og:title", content: "الرئيسية — وكيل" },
      { property: "og:description", content: "لوحة وكيل الرئيسية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { t, dir, lang } = useI18n();
  const Chevron = dir === "rtl" ? ChevronLeft : ChevronRight;
  const profile = useQuery(profileQuery);
  const providers = useQuery(providersQuery);
  const routing = useQuery(routingQuery);
  const models = useQuery(modelsQuery);
  const convos = useQuery(conversationsQuery);
  const newChat = useNewChat();

  const preferred = models.data?.find((m) => m.id === routing.data?.preferred_model_id);
  const name = profile.data?.profile?.display_name;

  return (
    <PageBody className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t.home.greeting}</h1>
        {name && <p className="mt-1 text-lg text-muted-foreground">{name}</p>}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickAction onClick={() => newChat.mutate()} icon={MessageSquarePlus} label={t.home.newChat} primary />
        <QuickAction to="/providers" icon={Server} label={t.nav.providers} />
        <QuickAction to="/models" icon={Boxes} label={t.nav.models} />
        <QuickAction to="/settings" icon={Settings} label={t.nav.settings} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t.home.currentRouting} link="/settings">
          {routing.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <div className="space-y-2">
              <div className="text-xl font-semibold">{t.routing[(routing.data?.mode ?? "AUTO") as keyof typeof t.routing] as string}</div>
              <div className="text-sm text-muted-foreground">
                {t.home.preferredModel}:{" "}
                <span className="font-mono text-foreground" dir="ltr">
                  {preferred ? preferred.display_name : t.home.auto}
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card title={t.home.providerHealth} link="/providers">
          {providers.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : providers.data?.length ? (
            <ul className="space-y-2">
              {providers.data.slice(0, 4).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{p.name}</span>
                  <StatusChip status={p.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-muted-foreground">
              {t.home.noProviders}{" "}
              <Link to="/providers" className="font-semibold text-primary">
                {t.home.addFirst}
              </Link>
            </div>
          )}
        </Card>
      </div>

      <Card title={t.home.recent} link="/chats">
        {convos.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : convos.data?.length ? (
          <ul className="-mx-2 divide-y divide-border">
            {convos.data.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link to="/chats/$id" params={{ id: c.id }} className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-muted">
                  <span className="truncate" dir="auto">{c.title || t.chat.untitled}</span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {new Date(c.updated_at).toLocaleDateString(lang === "ar" ? "ar" : "en", { month: "short", day: "numeric" })}
                    <Chevron className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t.home.noChats}</p>
        )}
      </Card>
    </PageBody>
  );
}

function Card({ title, link, children }: { title: string; link?: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {link && (
          <Link to={link} className="text-sm font-medium text-primary">
            {t.common.seeAll}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function QuickAction({
  to,
  onClick,
  icon: Icon,
  label,
  primary,
}: {
  to?: string;
  onClick?: () => void;
  icon: typeof Server;
  label: string;
  primary?: boolean;
}) {
  const cls = `flex min-h-24 flex-col justify-between rounded-xl border p-4 text-start transition-colors ${
    primary ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "border-border bg-card hover:bg-muted"
  }`;
  const inner = (
    <>
      <Icon className="size-5" />
      <span className="text-[15px] font-semibold">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
