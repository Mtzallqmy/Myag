import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Monitor, Moon, ShieldCheck, Sun, Info } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { ModelPicker } from "@/components/app/ModelPicker";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ROUTING_MODES } from "@/lib/ai/types";
import { modelsQuery, profileQuery, providersQuery, qk, routingQuery } from "@/lib/queries";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme, type ThemePref } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — وكيل" },
      { name: "description", content: "اللغة والمظهر وتفضيل التوجيه والأمان." },
      { property: "og:title", content: "الإعدادات — وكيل" },
      { property: "og:description", content: "إعدادات حساب وكيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const profile = useQuery(profileQuery);
  const routing = useQuery(routingQuery);
  const models = useQuery(modelsQuery);
  const providers = useQuery(providersQuery);

  async function saveProfile(patch: { language?: string; theme?: string }) {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) await supabase.from("profiles").update(patch).eq("id", u.user.id);
  }

  async function saveRouting(patch: { mode?: string; fallback_enabled?: boolean; preferred_model_id?: string | null; preferred_provider_id?: string | null }) {
    if (!routing.data) return;
    await supabase.from("routing_preferences").update(patch).eq("id", routing.data.id);
    qc.invalidateQueries({ queryKey: qk.routing });
  }

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <>
      <PageHeader title={t.settings.title} sub={profile.data?.email} />
      <PageBody className="space-y-4">
        <Section title={t.settings.language}>
          <Segmented<Lang>
            value={lang}
            onChange={(v) => {
              setLang(v);
              void saveProfile({ language: v });
            }}
            options={[
              { value: "ar", label: "العربية" },
              { value: "en", label: "English" },
            ]}
          />
        </Section>

        <Section title={t.settings.theme}>
          <Segmented<ThemePref>
            value={theme}
            onChange={(v) => {
              setTheme(v);
              void saveProfile({ theme: v });
            }}
            options={[
              { value: "light", label: t.settings.light, icon: Sun },
              { value: "dark", label: t.settings.dark, icon: Moon },
              { value: "system", label: t.settings.system, icon: Monitor },
            ]}
          />
        </Section>

        <Section title={t.settings.routing}>
          <div className="space-y-4">
            <Select value={routing.data?.mode ?? "AUTO"} onValueChange={(v) => saveRouting({ mode: v })}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUTING_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t.routing[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-1.5">
              <div className="text-sm text-muted-foreground">{t.home.preferredModel}</div>
              <div className="flex gap-2">
                <ModelPicker
                  className="min-w-0 flex-1"
                  models={models.data ?? []}
                  providers={providers.data ?? []}
                  value={routing.data?.preferred_model_id ?? null}
                  onChange={(id) => {
                    const m = models.data?.find((x) => x.id === id);
                    void saveRouting({ preferred_model_id: id, preferred_provider_id: m?.provider_id ?? null });
                  }}
                />
                {routing.data?.preferred_model_id && (
                  <Button variant="ghost" onClick={() => saveRouting({ preferred_model_id: null, preferred_provider_id: null })}>
                    {t.common.close}
                  </Button>
                )}
              </div>
            </div>
            <label className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{t.routing.fallback}</div>
                <div className="text-sm text-muted-foreground">{t.routing.fallbackDesc}</div>
              </div>
              <Switch checked={routing.data?.fallback_enabled ?? true} onCheckedChange={(v) => saveRouting({ fallback_enabled: v })} />
            </label>
          </div>
        </Section>

        <Section title={t.settings.security} icon={ShieldCheck}>
          <ul className="space-y-2 text-[15px] text-muted-foreground">
            {t.settings.securityBody.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                {s}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t.settings.about} icon={Info}>
          <p className="text-[15px] text-muted-foreground">{t.settings.aboutBody}</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground" dir="ltr">
            {t.settings.version} 0.1.0 · stage-1
          </p>
        </Section>

        <Button variant="outline" className="h-12 w-full border-destructive/40 text-base text-destructive hover:bg-destructive/10" onClick={signOut}>
          <LogOut className="size-4" /> {t.settings.signOut}
        </Button>
      </PageBody>
    </>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Sun; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        {Icon && <Icon className="size-4 text-primary" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: typeof Sun }[];
}) {
  return (
    <div className="grid gap-1 rounded-lg bg-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {Icon && <Icon className="size-4" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
