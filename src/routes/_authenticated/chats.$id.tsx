import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Copy, RotateCcw, Send, Square, AlertTriangle, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Markdown } from "@/components/app/Markdown";
import { ModelPicker } from "@/components/app/ModelPicker";
import { supabase } from "@/integrations/supabase/client";
import { ROUTING_MODES } from "@/lib/ai/types";
import { conversationQuery, messagesQuery, modelsQuery, providersQuery, qk, type Message } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chats/$id")({
  head: () => ({
    meta: [
      { title: "محادثة — وكيل" },
      { name: "description", content: "محادثة برمجية مع وكيل الذكاء الاصطناعي." },
      { property: "og:title", content: "محادثة — وكيل" },
      { property: "og:description", content: "محادثة مع الوكيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

interface Live {
  text: string;
  model?: string;
  fallbacks: { model: string; code: string }[];
}

function ChatPage() {
  const { id } = Route.useParams();
  const { t, dir, errorText } = useI18n();
  const qc = useQueryClient();
  const convo = useQuery(conversationQuery(id));
  const msgs = useQuery(messagesQuery(id));
  const models = useQuery(modelsQuery);
  const providers = useQuery(providersQuery);
  const [input, setInput] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const liveRef = useRef<{ messageId?: string; text: string }>({ text: "" });
  const bottomRef = useRef<HTMLDivElement>(null);
  const Back = dir === "rtl" ? ArrowRight : ArrowLeft;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth" });
  }, [msgs.data?.length, live?.text, pendingUser, streaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function updateConvo(patch: { routing_mode?: string; active_model_id?: string | null }) {
    await supabase.from("conversations").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: qk.conversation(id) });
  }

  async function run(body: { content?: string; retry?: boolean }) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) { toast.error(errorText("UNAUTHORIZED")); return; }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    liveRef.current = { text: "" };
    setStreaming(true);
    setLive({ text: "", fallbacks: [] });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${s.session.access_token}` },
        body: JSON.stringify({ conversationId: id, ...body }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(errorText(j.error));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const ev = /^event: (.+)$/m.exec(raw)?.[1];
          const dataLine = /^data: (.*)$/m.exec(raw)?.[1];
          if (!ev || !dataLine) continue;
          const data = JSON.parse(dataLine);
          if (ev === "start") {
            liveRef.current.messageId = data.messageId;
            setPendingUser(null);
            qc.invalidateQueries({ queryKey: qk.messages(id) });
          } else if (ev === "delta") {
            liveRef.current.text += data.text;
            setLive((l) => (l ? { ...l, text: l.text + data.text } : l));
          } else if (ev === "model") {
            setLive((l) => (l ? { ...l, model: data.name } : l));
          } else if (ev === "fallback") {
            setLive((l) => (l ? { ...l, fallbacks: [...l.fallbacks, data] } : l));
          } else if (ev === "error") {
            toast.error(errorText(data.code));
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        // Persist the partial answer as cancelled (server also marks it when it notices).
        const mid = liveRef.current.messageId;
        if (mid) {
          await supabase
            .from("messages")
            .update({ status: "CANCELLED", content: liveRef.current.text })
            .eq("id", mid)
            .eq("status", "STREAMING");
        }
      } else {
        toast.error(errorText("NETWORK_ERROR"));
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setPendingUser(null);
      await qc.invalidateQueries({ queryKey: qk.messages(id) });
      setLive(null);
      qc.invalidateQueries({ queryKey: qk.conversations });
      qc.invalidateQueries({ queryKey: qk.conversation(id) });
    }
  }

  function send() {
    const content = input.trim();
    if (!content || streaming) return;
    setInput("");
    setPendingUser(content);
    void run({ content });
  }

  const list = msgs.data ?? [];
  const last = list[list.length - 1];
  const lastIsFailed = !!last && (last.role === "user" || (last.role === "assistant" && last.status !== "COMPLETE" && last.status !== "STREAMING"));
  const visible = list.filter((m) => !(streaming && m.id === liveRef.current.messageId));
  const mode = convo.data?.routing_mode ?? "AUTO";

  return (
    <div className="flex h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] flex-col md:h-dvh">
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-3 py-2.5 md:px-6">
          <Button asChild variant="ghost" size="icon" aria-label={t.common.back}>
            <Link to="/chats">
              <Back className="size-5" />
            </Link>
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold" dir="auto">
            {convo.data?.title || t.chat.untitled}
          </h1>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Select value={mode} onValueChange={(v) => updateConvo({ routing_mode: v })}>
              <SelectTrigger className="h-10 w-[150px]" aria-label={t.chat.routing}>
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
            {mode === "MANUAL" && (
              <ModelPicker
                className="min-w-0 flex-1 sm:w-56"
                models={models.data ?? []}
                providers={providers.data ?? []}
                value={convo.data?.active_model_id ?? null}
                onChange={(mid) => updateConvo({ active_model_id: mid })}
              />
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 md:px-6">
          {msgs.isLoading && (
            <div className="space-y-3">
              <Skeleton className="ms-auto h-12 w-2/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
          {!msgs.isLoading && visible.length === 0 && !pendingUser && !live && (
            <div className="py-16 text-center text-muted-foreground">{t.chat.empty}</div>
          )}
          {visible.map((m) => (
            <MessageRow key={m.id} m={m} />
          ))}
          {pendingUser && <UserBubble text={pendingUser} />}
          {live && (
            <div className="space-y-2">
              {live.fallbacks.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-warning-foreground dark:text-warning">
                  <Shuffle className="size-3.5" /> {t.chat.fallbackUsed}: <span className="font-mono" dir="ltr">{f.model}</span> — {errorText(f.code)}
                </div>
              ))}
              {live.model && <div className="font-mono text-xs text-muted-foreground" dir="ltr">{live.model}</div>}
              {live.text ? (
                <Markdown text={live.text} />
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-2 animate-pulse rounded-full bg-primary" /> {t.chat.thinking}
                </div>
              )}
            </div>
          )}
          {!streaming && lastIsFailed && (
            <Button variant="outline" size="sm" onClick={() => run({ retry: true })}>
              <RotateCcw className="size-4" /> {t.common.retry}
            </Button>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-4xl items-end gap-2 px-3 py-3 md:px-6">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.innerWidth >= 768) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t.chat.placeholder}
            dir="auto"
            rows={1}
            className="max-h-48 min-h-12 resize-none text-base"
          />
          {streaming ? (
            <Button size="icon" variant="destructive" className="size-12 shrink-0" onClick={() => abortRef.current?.abort()} aria-label={t.chat.stop}>
              <Square className="size-4" />
            </Button>
          ) : (
            <Button size="icon" className="size-12 shrink-0" onClick={send} disabled={!input.trim()} aria-label={t.chat.send}>
              <Send className="size-4 rtl:-scale-x-100" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-ee-sm bg-primary px-4 py-2.5 text-primary-foreground" dir="auto">
        {text}
      </div>
    </div>
  );
}

function MessageRow({ m }: { m: Message }) {
  const { t, errorText } = useI18n();
  if (m.role === "user") return <UserBubble text={m.content} />;
  const meta = (m.metadata_json ?? {}) as { model_name?: string; fallback?: { model: string; code: string }[]; error_code?: string };
  return (
    <div className="group space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {meta.model_name && <span className="font-mono" dir="ltr">{meta.model_name}</span>}
        {!!meta.fallback?.length && m.status === "COMPLETE" && (
          <span className="inline-flex items-center gap-1 text-warning-foreground dark:text-warning">
            <Shuffle className="size-3" /> {t.chat.fallbackUsed}
          </span>
        )}
      </div>
      {m.content && <Markdown text={m.content} />}
      {m.status === "CANCELLED" && <div className="text-xs text-muted-foreground">— {t.chat.cancelled}</div>}
      {m.status === "ERROR" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4" /> {t.chat.failed}: {errorText(meta.error_code)}
        </div>
      )}
      {m.content && (
        <button
          className={cn("flex items-center gap-1 text-xs text-muted-foreground opacity-70 hover:opacity-100")}
          onClick={() => {
            navigator.clipboard.writeText(m.content);
            toast.success(t.common.copied);
          }}
        >
          <Copy className="size-3.5" /> {t.common.copy}
        </button>
      )}
    </div>
  );
}
