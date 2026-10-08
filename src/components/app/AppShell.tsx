import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FolderGit2, Home, ListChecks, Menu, MessagesSquare, Boxes, Server, Settings, Github, Plug, Brain, History, Search, BarChart3, ShieldCheck } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo-mark.png";

const primary = [
  { to: "/home", icon: Home, key: "home" },
  { to: "/chats", icon: MessagesSquare, key: "chats" },
  { to: "/projects", icon: FolderGit2, key: "projects" },
  { to: "/tasks", icon: ListChecks, key: "tasks" },
  { to: "/more", icon: Menu, key: "more" },
] as const;

const secondary = [
  { to: "/providers", icon: Server, key: "providers" },
  { to: "/models", icon: Boxes, key: "models" },
  { to: "/github", icon: Github, key: "github" },
  { to: "/integrations", icon: Plug, key: "integrations" },
  { to: "/search", icon: Search, key: "search" },
  { to: "/history", icon: History, key: "history" },
  { to: "/memory", icon: Brain, key: "memory" },
  { to: "/usage", icon: BarChart3, key: "usage" },
  { to: "/admin", icon: ShieldCheck, key: "admin" },
  { to: "/settings", icon: Settings, key: "settings" },
] as const;

type SecKey = (typeof secondary)[number]["key"];

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const moreActive = ["/more", "/providers", "/models", "/settings", "/github", "/integrations", "/search", "/history", "/memory", "/usage", "/admin", "/notifications"].some((p) => pathname.startsWith(p));

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop / tablet sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-sidebar-border bg-sidebar md:flex">
        <Link to="/home" className="flex items-center gap-2.5 px-5 py-5">
          <img src={logo} alt="" width={32} height={32} className="size-8 rounded-lg" />
          <div className="leading-tight">
            <div className="text-lg font-bold">{t.app.name}</div>
            <div className="text-xs text-muted-foreground">{t.app.tagline}</div>
          </div>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
          {primary
            .filter((i) => i.key !== "more")
            .map((i) => (
              <SideLink key={i.to} to={i.to} icon={i.icon} label={t.nav[i.key]} />
            ))}
          <div className="my-3 h-px bg-sidebar-border" />
          {secondary.map((i) => (
            <SideLink key={i.to} to={i.to} icon={i.icon} label={secLabel(t, i.key)} />
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>

      {/* Mobile bottom navigation */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {primary.map((i) => {
            const active = i.key === "more" ? moreActive : pathname.startsWith(i.to);
            const Icon = i.icon;
            return (
              <Link
                key={i.to}
                to={i.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[12px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                {t.nav[i.key]}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SideLink({ to, icon: Icon, label }: { to: string; icon: typeof Home; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      activeProps={{ className: "bg-sidebar-accent !text-sidebar-foreground font-semibold" }}
    >
      <Icon className="size-[18px]" />
      {label}
    </Link>
  );
}

export function PageHeader({ title, actions, sub }: { title: ReactNode; actions?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 md:px-8">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold md:text-2xl">{title}</h1>
          {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-8", className)}>{children}</div>;
}

export function secLabel(t: ReturnType<typeof useI18n>["t"], key: SecKey): string {
  if (key === "github" || key === "integrations") return t.nav2[key];
  if (key === "search" || key === "history" || key === "memory" || key === "usage" || key === "admin") return t.nav3[key];
  return t.nav[key];
}
