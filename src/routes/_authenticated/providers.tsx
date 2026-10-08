import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, MoreVertical, Pencil, Plus, Power, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { StatusChip } from "@/components/app/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProvider, deleteProvider, testProvider, updateProvider } from "@/lib/providers.functions";
import { PROVIDER_TYPES, type ProviderType } from "@/lib/ai/types";
import { validateOutboundUrl } from "@/lib/ai/url-guard";
import { modelsQuery, providersQuery, qk, type Provider } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/providers")({
  head: () => ({
    meta: [
      { title: "مزودات API — وكيل" },
      { name: "description", content: "أضف واختبر مزودات الذكاء الاصطناعي المتوافقة مع OpenAI." },
      { property: "og:title", content: "مزودات API — وكيل" },
      { property: "og:description", content: "إدارة مزودات الذكاء الاصطناعي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProvidersPage,
});

const DEFAULT_URLS: Partial<Record<ProviderType, string>> = {
  OPENROUTER: "https://openrouter.ai/api/v1",
  NVIDIA_NIM: "https://integrate.api.nvidia.com/v1",
};

function ProvidersPage() {
  const { t, lang, errorText } = useI18n();
  const qc = useQueryClient();
  const providers = useQuery(providersQuery);
  const models = useQuery(modelsQuery);
  const [editing, setEditing] = useState<Provider | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const test = useServerFn(testProvider);
  const del = useServerFn(deleteProvider);
  const upd = useServerFn(updateProvider);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.providers });
    qc.invalidateQueries({ queryKey: qk.models });
  };

  async function runTest(p: Provider) {
    setBusyId(p.id);
    const r = await test({ data: { id: p.id } }).catch(() => ({ ok: false as const, error: "UNEXPECTED" }));
    setBusyId(null);
    refresh();
    if (!r.ok) { toast.error(errorText(r.error)); return; }
    if (r.data.status === "ONLINE") toast.success(`${t.providers.tested} · ${r.data.modelCount} ${t.providers.models}`);
    else toast.error(`${t.status[r.data.status as keyof typeof t.status] ?? r.data.status} · ${errorText(r.data.code)}`);
  }

  async function runDelete(p: Provider) {
    if (!confirm(t.providers.deleteConfirm)) return;
    const r = await del({ data: { id: p.id } });
    if (!r.ok) toast.error(errorText(r.error));
    refresh();
  }

  async function toggle(p: Provider) {
    setBusyId(p.id);
    const r = await upd({ data: { id: p.id, disabled: p.status !== "DISABLED" } });
    setBusyId(null);
    if (!r.ok) toast.error(errorText(r.error));
    refresh();
  }

  const countFor = (id: string) => models.data?.filter((m) => m.provider_id === id && m.is_available).length ?? 0;

  return (
    <>
      <PageHeader
        title={t.providers.title}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t.providers.add.replace("➕ ", "")}</span>
          </Button>
        }
      />
      <PageBody className="space-y-3">
        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          {t.providers.secureNote}
        </p>
        {providers.isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-32 w-full" />)
        ) : !providers.data?.length ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="mb-4 text-muted-foreground">{t.providers.empty}</p>
            <Button onClick={() => setEditing("new")}>{t.providers.add}</Button>
          </div>
        ) : (
          providers.data.map((p) => (
            <article key={p.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{p.name}</h2>
                    <StatusChip status={busyId === p.id ? "CHECKING" : p.status} />
                  </div>
                  <div className="mt-1 truncate font-mono text-sm text-muted-foreground" dir="ltr">
                    {p.base_url}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="menu">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(p)}>
                      <Pencil className="size-4" /> {t.common.edit}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggle(p)}>
                      <Power className="size-4" /> {p.status === "DISABLED" ? t.providers.enable : t.providers.disable}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => runDelete(p)}>
                      <Trash2 className="size-4" /> {t.common.delete}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{t.providerTypes[p.provider_type as ProviderType] ?? p.provider_type}</span>
                <span className="inline-flex items-center gap-1">
                  <KeyRound className="size-3.5" />
                  <span className="font-mono" dir="ltr">{p.token_hint ?? "••••"}</span>
                </span>
                <span>
                  {countFor(p.id)} {t.providers.models}
                </span>
                <span>
                  {t.providers.lastChecked}:{" "}
                  {p.last_checked_at
                    ? new Date(p.last_checked_at).toLocaleString(lang === "ar" ? "ar" : "en", { dateStyle: "short", timeStyle: "short" })
                    : t.providers.never}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => runTest(p)} disabled={busyId === p.id || p.status === "DISABLED"}>
                  {busyId === p.id ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  {t.providers.test} · {t.providers.refresh}
                </Button>
              </div>
            </article>
          ))
        )}
      </PageBody>

      {editing && (
        <ProviderDialog
          provider={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}

function ProviderDialog({ provider, onClose, onSaved }: { provider: Provider | null; onClose: () => void; onSaved: () => void }) {
  const { t, errorText } = useI18n();
  const create = useServerFn(createProvider);
  const update = useServerFn(updateProvider);
  const [name, setName] = useState(provider?.name ?? "");
  const [type, setType] = useState<ProviderType>((provider?.provider_type as ProviderType) ?? "OPENAI_COMPATIBLE");
  const [baseUrl, setBaseUrl] = useState(provider?.base_url ?? "");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const urlCheck = baseUrl ? validateOutboundUrl(baseUrl) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (urlCheck && !urlCheck.ok) { toast.error(errorText(urlCheck.error)); return; }
    setBusy(true);
    try {
      if (!provider) {
        const r = await create({ data: { name, providerType: type, baseUrl, token } });
        if (!r.ok) { toast.error(errorText(r.error)); return; }
        if (r.data.status === "ONLINE") toast.success(`${t.providers.created} · ${r.data.modelCount} ${t.providers.models}`);
        else toast.warning(`${t.providers.created} · ${t.status[r.data.status as keyof typeof t.status] ?? ""} — ${errorText(r.data.code)}`);
      } else {
        const r = await update({
          data: {
            id: provider.id,
            name,
            providerType: type,
            ...(baseUrl !== provider.base_url ? { baseUrl } : {}),
            ...(token ? { token } : {}),
          },
        });
        if (!r.ok) { toast.error(errorText(r.error)); return; }
        toast.success(t.providers.tested);
      }
      onSaved();
      onClose();
    } catch {
      toast.error(errorText("UNEXPECTED"));
    } finally {
      setBusy(false);
      setToken("");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{provider ? t.common.edit : t.providers.add}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pname">{t.providers.name}</Label>
            <Input id="pname" required maxLength={80} className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.providers.type}</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as ProviderType);
                const d = DEFAULT_URLS[v as ProviderType];
                if (d && !baseUrl) setBaseUrl(d);
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_TYPES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t.providerTypes[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purl">{t.providers.baseUrl}</Label>
            <Input
              id="purl"
              required
              dir="ltr"
              inputMode="url"
              placeholder="https://api.example.com/v1"
              className="h-11 font-mono text-sm"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            {urlCheck && !urlCheck.ok && <p className="text-sm text-destructive">{errorText(urlCheck.error)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ptoken">{t.providers.token}</Label>
            <Input
              id="ptoken"
              type="password"
              dir="ltr"
              autoComplete="off"
              required={!provider}
              minLength={8}
              className="h-11 font-mono text-sm"
              placeholder={provider ? (provider.token_hint ?? "") : "sk-…"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            {provider && <p className="text-xs text-muted-foreground">{t.providers.tokenKeep}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t.providers.saveTest}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
