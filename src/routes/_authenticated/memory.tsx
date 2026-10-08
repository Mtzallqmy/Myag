import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { addMemory } from "@/lib/stage3.functions";
import { MEMORY_KINDS, MEMORY_TABLE, type MemoryKind } from "@/lib/memory/validate";
import { memoryQuery, qk3 } from "@/lib/queries3";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/memory")({
  head: () => ({
    meta: [
      { title: "الذاكرة — وكيل" },
      { name: "description", content: "ذاكرة المحادثات والمشاريع والتفضيلات والمهام في وكيل." },
      { property: "og:title", content: "الذاكرة — وكيل" },
      { property: "og:description", content: "عرض ومسح ذاكرة الوكيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MemoryPage,
});

function MemoryPage() {
  const { t, lang, errorText } = useI18n();
  const qc = useQueryClient();
  const [kind, setKind] = useState<MemoryKind>("preferences");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const add = useServerFn(addMemory);
  const items = useQuery(memoryQuery(kind));

  const submit = async () => {
    setBusy(true);
    const r = await add({ data: { kind, summary: text } });
    setBusy(false);
    if (!r.ok) { toast.error(errorText(r.error)); return; }
    setText("");
    qc.invalidateQueries({ queryKey: qk3.memory(kind) });
  };
  const remove = async (id?: string) => {
    if (!id && !confirm(t.memory.clearConfirm)) return undefined;
    const q = supabase.from(MEMORY_TABLE[kind]).delete();
    const { error } = id ? await q.eq("id", id) : await q.not("id", "is", null);
    if (error) { toast.error(errorText("UNEXPECTED")); return; }
    qc.invalidateQueries({ queryKey: qk3.memory(kind) });
  };

  return (
    <>
      <PageHeader title={t.memory.title} sub={t.memory.rules} />
      <PageBody className="space-y-4">
        <Tabs value={kind} onValueChange={(v) => setKind(v as MemoryKind)}>
          <TabsList className="h-auto w-full flex-wrap justify-start">
            {MEMORY_KINDS.map((k) => (
              <TabsTrigger key={k} value={k} className="min-h-10">{t.memory[k]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={t.memory.placeholder} aria-label={t.memory.placeholder} />
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => remove()} disabled={!items.data?.length}>{t.memory.clear}</Button>
            <Button onClick={submit} disabled={busy || text.trim().length < 3}>{t.memory.add}</Button>
          </div>
        </div>
        {items.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !items.data?.length ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">{t.memory.empty}</div>
        ) : (
          <ul className="space-y-2">
            {items.data.map((m) => (
              <li key={m.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words">{m.summary}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.memory.source}: {m.source} · {t.memory.confidence}: {Math.round(m.confidence * 100)}% · {new Date(m.created_at).toLocaleDateString(lang)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="size-11" aria-label={t.common.delete} onClick={() => remove(m.id)}>
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
