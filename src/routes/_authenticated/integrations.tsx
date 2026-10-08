import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { z } from "zod";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { Chip } from "@/components/app/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { addMcpServer, callMcpTool, refreshMcpServer, setMcpToolState, startMcpOAuth } from "@/lib/mcp.functions";
import { validateOutboundUrl } from "@/lib/ai/url-guard";
import { githubQuery, mcpQuery, qk2, registryQuery, type McpTool } from "@/lib/queries2";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/integrations")({
  validateSearch: (s) => z.object({ oauth: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "التكاملات و MCP — وكيل" },
      { name: "description", content: "اربط خوادم MCP، اكتشف الأدوات، وتحكم بالصلاحيات." },
      { property: "og:title", content: "التكاملات و MCP — وكيل" },
      { property: "og:description", content: "تكاملات وكيل وخوادم MCP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntegrationsPage,
});

const riskTone: Record<string, string> = {
  LOW: "border-success/30 bg-success/10 text-success",
  MEDIUM: "border-warning/40 bg-warning/10",
  HIGH: "border-destructive/30 bg-destructive/10 text-destructive",
  CRITICAL: "border-destructive bg-destructive text-destructive-foreground",
};

const REGISTRY = ["github", "supabase", "google_drive", "gmail", "google_calendar", "railway", "custom_mcp"] as const;
const REG_NAMES: Record<string, string> = {
  github: "GitHub", supabase: "Lovable Cloud", google_drive: "Google Drive", gmail: "Gmail", google_calendar: "Google Calendar", railway: "Railway", custom_mcp: "Custom MCP",
};

function IntegrationsPage() {
  const { t, errorText } = useI18n();
  const qc = useQueryClient();
  const { oauth } = Route.useSearch();
  const mcp = useQuery(mcpQuery);
  const registry = useQuery(registryQuery);
  const gh = useQuery(githubQuery);
  const refresh = useServerFn(refreshMcpServer);
  const startOAuth = useServerFn(startMcpOAuth);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"tools" | "resources" | "prompts">("tools");
  const [runTool, setRunTool] = useState<McpTool | null>(null);

  useEffect(() => {
    if (!oauth) return;
    const msg = t.mcp.oauthResult[oauth];
    if (msg) (oauth === "ok" ? toast.success : toast.error)(msg);
  }, [oauth, t]);

  const statusOf = (key: string) => {
    if (key === "supabase") return "MANAGED";
    if (key === "github") return gh.data?.connections.some((c) => c.status === "ACTIVE") ? "CONNECTED" : "NOT_CONNECTED";
    if (key === "custom_mcp") return mcp.data?.servers.some((s) => s.status === "CONNECTED") ? "CONNECTED" : "NOT_CONNECTED";
    return registry.data?.find((r) => r.integration_key === key)?.status ?? "PLANNED";
  };

  return (
    <>
      <PageHeader
        title={t.mcp.title}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t.mcp.add.replace("➕ ", "")}</span>
          </Button>
        }
      />
      <PageBody className="space-y-6">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{t.mcp.registry}</h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {REGISTRY.map((k) => {
              const st = statusOf(k);
              const inner = (
                <>
                  <div className="font-semibold">{REG_NAMES[k]}</div>
                  <div className={cn("text-xs", st === "CONNECTED" || st === "MANAGED" ? "text-success" : "text-muted-foreground")}>{t.mcp.regStatus[st] ?? st}</div>
                </>
              );
              return k === "github" ? (
                <Link key={k} to="/github" className="rounded-xl border border-border bg-card p-3 hover:bg-muted">{inner}</Link>
              ) : (
                <div key={k} className="rounded-xl border border-border bg-card p-3">{inner}</div>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{t.mcp.servers}</h2>
          {!mcp.data?.servers.length && <p className="text-muted-foreground">{t.mcp.empty}</p>}
          {mcp.data?.servers.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{s.name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground" dir="ltr">{s.url}</div>
                </div>
                <Chip>{t.mcp.status[s.status] ?? s.status}</Chip>
              </div>
              {s.last_error_code && s.status === "ERROR" && <p className="mt-2 text-sm text-destructive">{errorText(s.last_error_code)}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === s.id}
                  onClick={async () => {
                    setBusy(s.id);
                    const r = await refresh({ data: { serverId: s.id } });
                    setBusy(null);
                    if (!r.ok) toast.error(errorText(r.error));
                    else if (r.data.code) toast.error(errorText(r.data.code));
                    qc.invalidateQueries({ queryKey: qk2.mcp });
                  }}
                >
                  {busy === s.id ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  {t.mcp.refresh}
                </Button>
                {(s.status === "AUTH_REQUIRED" || s.auth_type === "OAUTH") && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      const r = await startOAuth({ data: { serverId: s.id } });
                      if (!r.ok) {
                        toast.error(errorText(r.error));
                        return;
                      }
                      window.location.href = r.data.authorizeUrl;
                    }}
                  >
                    <KeyRound className="size-4" /> {t.mcp.authorize}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    if (!confirm(t.providers.deleteConfirm)) return;
                    await supabase.from("mcp_servers").delete().eq("id", s.id);
                    qc.invalidateQueries({ queryKey: qk2.mcp });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </section>

        {!!mcp.data?.servers.length && (
          <section className="space-y-3">
            <div className="flex gap-1">
              {(["tools", "resources", "prompts"] as const).map((k) => (
                <button key={k} onClick={() => setTab(k)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                  {t.mcp[k]}
                </button>
              ))}
            </div>
            {tab === "tools" && (
              <>
                <p className="text-xs text-muted-foreground">{t.mcp.permissions}</p>
                <ul className="space-y-2">
                  {mcp.data.tools.map((tool) => (
                    <ToolRow key={tool.id} tool={tool} onRun={() => setRunTool(tool)} />
                  ))}
                </ul>
              </>
            )}
            {tab === "resources" && (
              <ul className="space-y-1.5">
                {mcp.data.resources.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border bg-card p-2.5">
                    <div className="font-medium">{r.name ?? r.uri}</div>
                    <div className="font-mono text-xs text-muted-foreground" dir="ltr">{r.uri}</div>
                  </li>
                ))}
                {!mcp.data.resources.length && <p className="text-muted-foreground">{t.project.noResults}</p>}
              </ul>
            )}
            {tab === "prompts" && (
              <ul className="space-y-1.5">
                {mcp.data.prompts.map((p) => (
                  <li key={p.id} className="rounded-lg border border-border bg-card p-2.5">
                    <div className="font-mono font-medium" dir="ltr">{p.name}</div>
                    {p.description && <div className="text-sm text-muted-foreground">{p.description}</div>}
                  </li>
                ))}
                {!mcp.data.prompts.length && <p className="text-muted-foreground">{t.project.noResults}</p>}
              </ul>
            )}
          </section>
        )}
      </PageBody>
      {adding && <AddServerDialog onClose={() => setAdding(false)} />}
      {runTool && <RunToolDialog tool={runTool} onClose={() => setRunTool(null)} />}
    </>
  );
}

function ToolRow({ tool, onRun }: { tool: McpTool; onRun: () => void }) {
  const { t, errorText } = useI18n();
  const qc = useQueryClient();
  const setState = useServerFn(setMcpToolState);
  async function update(enabled: boolean, approvalRequired: boolean) {
    let confirmCritical = false;
    if (tool.risk_level === "CRITICAL" && enabled) {
      if (!confirm(t.mcp.criticalConfirm)) return;
      confirmCritical = true;
    }
    const r = await setState({ data: { toolId: tool.id, enabled, approvalRequired, confirmCritical } });
    if (!r.ok) toast.error(errorText(r.error));
    qc.invalidateQueries({ queryKey: qk2.mcp });
  }
  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold" dir="ltr">{tool.name}</div>
          {tool.description && <div className="line-clamp-2 text-sm text-muted-foreground">{tool.description}</div>}
        </div>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium", riskTone[tool.risk_level])}>{t.approval.risks[tool.risk_level]}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <Switch checked={tool.enabled} onCheckedChange={(v) => update(v, tool.approval_required)} />
          {t.mcp.enabled}
        </label>
        <label className={cn("flex items-center gap-2", tool.risk_level !== "LOW" && "opacity-60")}>
          <Switch checked={tool.approval_required} disabled={tool.risk_level !== "LOW"} onCheckedChange={(v) => update(tool.enabled, v)} />
          {t.mcp.approval}
        </label>
        <Button size="sm" variant="outline" disabled={!tool.enabled} onClick={onRun}>
          <Play className="size-3.5" /> {t.mcp.run}
        </Button>
      </div>
    </li>
  );
}

function AddServerDialog({ onClose }: { onClose: () => void }) {
  const { t, errorText } = useI18n();
  const qc = useQueryClient();
  const add = useServerFn(addMcpServer);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [bearer, setBearer] = useState("");
  const [busy, setBusy] = useState(false);
  const check = url ? validateOutboundUrl(url) : null;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (check && !check.ok) return;
    setBusy(true);
    const r = await add({ data: { name, url, ...(bearer ? { bearer } : {}) } }).catch(() => ({ ok: false as const, error: "UNEXPECTED" }));
    setBusy(false);
    if (!r.ok) {
      toast.error(errorText(r.error));
      return;
    }
    if (r.data.code) toast.warning(errorText(r.data.code));
    else toast.success(`${r.data.tools} ${t.mcp.tools}`);
    qc.invalidateQueries({ queryKey: qk2.mcp });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.mcp.add}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mn">{t.mcp.name}</Label>
            <Input id="mn" required maxLength={80} className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mu">{t.mcp.url}</Label>
            <Input id="mu" required dir="ltr" className="h-11 font-mono text-sm" placeholder="https://example.com/mcp" value={url} onChange={(e) => setUrl(e.target.value)} />
            {check && !check.ok && <p className="text-sm text-destructive">{errorText(check.error)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mb">{t.mcp.bearer}</Label>
            <Input id="mb" type="password" dir="ltr" autoComplete="off" className="h-11 font-mono text-sm" value={bearer} onChange={(e) => setBearer(e.target.value)} />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>{t.common.cancel}</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RunToolDialog({ tool, onClose }: { tool: McpTool; onClose: () => void }) {
  const { t, errorText } = useI18n();
  const call = useServerFn(callMcpTool);
  const [args, setArgs] = useState("{}");
  const [confirmed, setConfirmed] = useState(!tool.approval_required);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  async function run() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(args) as Record<string, unknown>;
    } catch {
      toast.error("JSON");
      return;
    }
    setBusy(true);
    const r = await call({ data: { toolId: tool.id, args: parsed, confirmed } }).catch(() => ({ ok: false as const, error: "UNEXPECTED" }));
    setBusy(false);
    if (!r.ok) {
      toast.error(errorText(r.error));
      return;
    }
    setOut(r.data.output);
  }
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono" dir="ltr">{tool.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label>{t.mcp.args}</Label>
          <Textarea value={args} onChange={(e) => setArgs(e.target.value)} rows={5} dir="ltr" className="font-mono text-sm" />
          {tool.approval_required && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
              {t.mcp.confirmRun}
            </label>
          )}
          {out && (
            <div>
              <Label>{t.mcp.output}</Label>
              <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-code p-3 text-xs text-code-foreground" dir="ltr">{out}</pre>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose}>{t.common.close}</Button>
          <Button onClick={run} disabled={busy || !confirmed}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t.mcp.run}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
