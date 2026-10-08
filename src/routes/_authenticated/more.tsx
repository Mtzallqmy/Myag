import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, BarChart3, Bell, Boxes, Brain, ChevronLeft, ChevronRight, Github, History, Plug, Search, Server, Settings, ShieldCheck } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/more")({
  head: () => ({
    meta: [
      { title: "المزيد — وكيل" },
      { name: "description", content: "المزودات والنماذج والإعدادات." },
      { property: "og:title", content: "المزيد — وكيل" },
      { property: "og:description", content: "روابط إضافية في وكيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MorePage,
});

function MorePage() {
  const { t, dir } = useI18n();
  const Chevron = dir === "rtl" ? ChevronLeft : ChevronRight;
  const items = [
    { to: "/providers", icon: Server, label: t.nav.providers },
    { to: "/models", icon: Boxes, label: t.nav.models },
    { to: "/github", icon: Github, label: t.nav2.github },
    { to: "/github-status", icon: Activity, label: t.ghStatus.title.replace("📡 ", "") },
    { to: "/integrations", icon: Plug, label: t.nav2.integrations },
    { to: "/search", icon: Search, label: t.nav3.search },
    { to: "/notifications", icon: Bell, label: t.nav3.notifications },
    { to: "/history", icon: History, label: t.nav3.history },
    { to: "/memory", icon: Brain, label: t.nav3.memory },
    { to: "/usage", icon: BarChart3, label: t.nav3.usage },
    { to: "/admin", icon: ShieldCheck, label: t.nav3.admin },
    { to: "/settings", icon: Settings, label: t.nav.settings },
  ] as const;
  return (
    <>
      <PageHeader title={t.nav.more} />
      <PageBody>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {items.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <Link to={to} className="flex items-center gap-3 px-4 py-4 text-[16px] font-medium hover:bg-muted">
                <Icon className="size-5 text-primary" />
                <span className="flex-1">{label}</span>
                <Chevron className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </PageBody>
    </>
  );
}
