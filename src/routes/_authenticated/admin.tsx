import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  adminAudit, adminFlags, adminHealth, adminList, adminOverview, adminSetFlag, adminSetKillSwitch, adminSetPlan, adminSetRole, claimFirstAdmin, getMyAccess,
} from "@/lib/stage3.functions";
import { PLAN_TIERS, staffCan, STAFF_ROLES } from "@/lib/policy/plans";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة الإدارة — وكيل" },
      { name: "description", content: "إدارة المستخدمين والمهام والمزودات والميزات ومفاتيح الطوارئ والتدقيق." },
      { property: "og:title", content: "لوحة الإدارة — وكيل" },
      { property: "og:description", content: "منطقة إدارة محمية بالأدوار على الخادم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const SECTIONS = ["overview", "users", "jobs", "providers", "models", "projects", "repositories", "mcp", "usage", "audit", "flags", "health"] as const;
type Section = (typeof SECTIONS)[number];
const LIST = ["users", "jobs", "providers", "models", "projects", "repositories", "mcp", "usage"] as const;

function AdminPage() {
  const { t, errorText } = useI18n();
  const qc = useQueryClient();
  const access = useServerFn(getMyAccess);
  const claim = useServerFn(claimFirstAdmin);
  const a = useQuery({ queryKey: ["access"], queryFn: () => access() });
  const [section, setSection] = useState<Section>("overview");

  if (a.isLoading) return <PageBody><Skeleton className="h-40 w-full" /></PageBody>;
  const roles = a.data?.roles ?? [];
  if (!staffCan(roles, "read")) {
    return (
      <>
        <PageHeader title={t.admin.title} />
        <PageBody className="space-y-4">
          <p className="text-muted-foreground">{t.admin.denied}</p>
          {a.data?.canClaimAdmin && (
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <p>{t.admin.claimHint}</p>
              <Button
                onClick={async () => {
                  const r = await claim();
                  qc.invalidateQueries({ queryKey: ["access"] });
                  if (!r.ok) toast.error(errorText(r.error));
                }}
              >
                {t.admin.claim}
              </Button>
            </div>
          )}
        </PageBody>
      </>
    );
  }
  const canWrite = staffCan(roles, "write");
  const visible = SECTIONS.filter((s) => s !== "audit" || staffCan(roles, "audit"));

  return (
    <>
      <PageHeader title={t.admin.title} sub={<span dir="ltr" className="font-mono">{roles.join(", ")}{canWrite ? "" : ` · ${t.admin.readOnly}`}</span>} />
      <PageBody className="space-y-4">
        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label={t.admin.title}>
          {visible.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              aria-current={section === s ? "page" : undefined}
              className={cn("min-h-10 shrink-0 rounded-lg px-3 text-sm", section === s ? "bg-primary text-primary-foreground" : "bg-card border border-border")}
            >
              {t.admin.sections[s]}
            </button>
          ))}
        </nav>
        {section === "overview" && <Overview />}
        {(LIST as readonly string[]).includes(section) && <ListSection key={section} section={section as (typeof LIST)[number]} canWrite={canWrite} canRoles={staffCan(roles, "roles")} />}
        {section === "audit" && <Audit />}
        {section === "flags" && <Flags canWrite={canWrite} />}
        {section === "health" && <Health />}
      </PageBody>
    </>
  );
}

function Overview() {
  const { t, errorText } = useI18n();
  const fn = useServerFn(adminOverview);
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: () => fn() });
  if (!q.data) return <Skeleton className="h-24 w-full" />;
  if (!q.data.ok) return <p className="text-destructive">{errorText(q.data.error)}</p>;
  const labels: Record<string, string> = {
    profiles: t.admin.sections["users"]!, agent_jobs: t.admin.sections["jobs"]!, ai_providers: t.admin.sections["providers"]!, ai_models: t.admin.sections["models"]!,
    projects: t.admin.sections["projects"]!, github_repositories: t.admin.sections["repositories"]!, mcp_servers: t.admin.sections["mcp"]!, usage_events: t.admin.sections["usage"]!,
  };
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Object.entries(q.data.data.counts).map(([k, v]) => (
        <div key={k} className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">{labels[k] ?? k}</div>
          <div className="mt-1 font-mono text-2xl font-semibold">{v}</div>
        </div>
      ))}
    </div>
  );
}

function cell(v: unknown) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 120);
  return String(v).slice(0, 120);
}

function DataTable({ rows, extra }: { rows: Record<string, unknown>[]; extra?: ((r: Record<string, unknown>) => React.ReactNode) | undefined }) {
  const { t } = useI18n();
  if (!rows.length) return <p className="text-muted-foreground">{t.common.none}</p>;
  const cols = Object.keys(rows[0]!);
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card" dir="ltr">
      <Table>
        <TableHeader>
          <TableRow>{cols.map((c) => <TableHead key={c} className="whitespace-nowrap font-mono text-xs">{c}</TableHead>)}{extra && <TableHead />}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={String(r["id"] ?? i)}>
              {cols.map((c) => <TableCell key={c} className="max-w-64 truncate whitespace-nowrap font-mono text-xs">{cell(r[c])}</TableCell>)}
              {extra && <TableCell className="whitespace-nowrap">{extra(r)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ListSection({ section, canWrite, canRoles }: { section: (typeof LIST)[number]; canWrite: boolean; canRoles: boolean }) {
  const { t, errorText } = useI18n();
  const qc = useQueryClient();
  const fn = useServerFn(adminList);
  const setPlan = useServerFn(adminSetPlan);
  const setRole = useServerFn(adminSetRole);
  const q = useQuery({ queryKey: ["admin", section], queryFn: () => fn({ data: { section } }) });
  if (!q.data) return <Skeleton className="h-40 w-full" />;
  if (!q.data.ok) return <p className="text-destructive">{errorText(q.data.error)}</p>;
  const done = (r: { ok: boolean; error?: string }) => {
    if (!r.ok) toast.error(errorText(r.error));
    qc.invalidateQueries({ queryKey: ["admin", section] });
  };
  return (
    <DataTable
      rows={q.data.data}
      extra={
        section === "users" && (canWrite || canRoles)
          ? (r) => (
              <div className="flex gap-2">
                {canWrite && (
                  <select aria-label={t.admin.setPlan} className="h-9 rounded-md border border-border bg-background px-2 text-xs" value={String(r["tier"])}
                    onChange={async (e) => done(await setPlan({ data: { userId: String(r["id"]), tier: e.target.value as (typeof PLAN_TIERS)[number] } }))}>
                    {PLAN_TIERS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                )}
                {canRoles && (
                  <select aria-label={t.admin.grantRole} className="h-9 rounded-md border border-border bg-background px-2 text-xs" value=""
                    onChange={async (e) => {
                      const [op, role] = e.target.value.split(":") as ["+" | "-", (typeof STAFF_ROLES)[number]];
                      if (role) done(await setRole({ data: { userId: String(r["id"]), role, grant: op === "+" } }));
                    }}>
                    <option value="">{t.admin.grantRole}…</option>
                    {STAFF_ROLES.map((s) => <option key={`+${s}`} value={`+:${s}`}>+ {s}</option>)}
                    {STAFF_ROLES.map((s) => <option key={`-${s}`} value={`-:${s}`}>− {s}</option>)}
                  </select>
                )}
              </div>
            )
          : undefined
      }
    />
  );
}

function Audit() {
  const { t, errorText } = useI18n();
  const fn = useServerFn(adminAudit);
  const [f, setF] = useState({ userId: "", action: "", entity: "", from: "", to: "", status: "", risk: "" });
  const [applied, setApplied] = useState(f);
  const clean = Object.fromEntries(Object.entries(applied).filter(([, v]) => v)) as never;
  const q = useQuery({ queryKey: ["admin", "audit", applied], queryFn: () => fn({ data: clean }) });
  const field = (k: keyof typeof f, label: string, type = "text") => (
    <Input type={type} aria-label={label} placeholder={label} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="h-10" />
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {field("userId", t.admin.userId)}
        {field("action", t.admin.action)}
        {field("entity", t.admin.entity)}
        {field("status", `${t.admin.status} (OK/FAILED/BLOCKED)`)}
        {field("risk", `${t.admin.risk} (LOW…CRITICAL)`)}
        {field("from", t.admin.from, "date")}
        {field("to", t.admin.to, "date")}
        <Button onClick={() => setApplied(f)}>{t.admin.filter}</Button>
      </div>
      {!q.data ? <Skeleton className="h-40 w-full" /> : !q.data.ok ? <p className="text-destructive">{errorText(q.data.error)}</p> : (
        <>
          <h3 className="font-semibold">{t.admin.sections["audit"]}</h3>
          <DataTable rows={q.data.data.audit} />
          <h3 className="font-semibold">{t.admin.events}</h3>
          <DataTable rows={q.data.data.events} />
        </>
      )}
    </div>
  );
}

function Flags({ canWrite }: { canWrite: boolean }) {
  const { t, errorText } = useI18n();
  const qc = useQueryClient();
  const fn = useServerFn(adminFlags);
  const setFlag = useServerFn(adminSetFlag);
  const setSwitch = useServerFn(adminSetKillSwitch);
  const q = useQuery({ queryKey: ["admin", "flags"], queryFn: () => fn() });
  if (!q.data) return <Skeleton className="h-40 w-full" />;
  if (!q.data.ok) return <p className="text-destructive">{errorText(q.data.error)}</p>;
  const after = (r: { ok: boolean; error?: string }) => {
    if (!r.ok) toast.error(errorText(r.error));
    qc.invalidateQueries({ queryKey: ["admin", "flags"] });
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 font-semibold">{t.admin.switches}</h3>
        <ul className="space-y-3">
          {q.data.data.switches.map((s: any) => (
            <li key={s.key} className="flex items-center justify-between gap-3">
              <span className="font-mono text-sm" dir="ltr">{s.key}{s.enabled ? " — ON" : ""}</span>
              <Switch disabled={!canWrite} checked={s.enabled} aria-label={s.key}
                onCheckedChange={async (v) => after(await setSwitch({ data: { key: s.key, enabled: v } }))} />
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 font-semibold">{t.admin.flags}</h3>
        <ul className="space-y-3">
          {q.data.data.flags.map((f: any) => (
            <li key={f.id} className="flex items-center justify-between gap-3">
              <span className="font-mono text-sm" dir="ltr">{f.key} · {f.scope}{f.target ? `:${String(f.target).slice(0, 8)}` : ""}</span>
              <Switch disabled={!canWrite} checked={f.enabled} aria-label={f.key}
                onCheckedChange={async (v) => after(await setFlag({ data: { key: f.key, scope: f.scope, target: f.target, enabled: v } }))} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Health() {
  const { t, errorText } = useI18n();
  const fn = useServerFn(adminHealth);
  const q = useQuery({ queryKey: ["admin", "health"], queryFn: () => fn() });
  if (!q.data) return <Skeleton className="h-40 w-full" />;
  if (!q.data.ok) return <p className="text-destructive">{errorText(q.data.error)}</p>;
  const d = q.data.data;
  const box = (title: string, body: React.ReactNode) => (
    <div className="rounded-xl border border-border bg-card p-4"><div className="text-sm text-muted-foreground">{title}</div><div className="mt-1 font-mono text-sm" dir="ltr">{body}</div></div>
  );
  const tally = (m: Record<string, number>) => (Object.keys(m).length ? Object.entries(m).map(([k, v]) => `${k}: ${v}`).join(" · ") : "—");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {box(t.admin.database, `${d.database.ok ? "OK" : "FAIL"} · ${d.database.latencyMs}ms`)}
        {box(t.admin.runtime, d.runtime.configured ? t.admin.configured : t.admin.notConfigured)}
        {box(t.admin.sections["providers"]!, tally(d.providers))}
        {box("GitHub", tally(d.github))}
        {box("MCP", tally(d.mcp))}
      </div>
      <h3 className="font-semibold">{t.admin.recentFailures}</h3>
      <DataTable rows={d.recentFailures as never} />
    </div>
  );
}
