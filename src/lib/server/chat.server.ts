// Streaming chat gateway (SSE). Authenticates the bearer token, routes to a model,
// streams the upstream provider response, applies bounded fallback, persists results.
import { z } from "zod";
import {hasCap} from "@/lib/ai/models";
import {resolveVisionPreviews} from "./chat-media.server";
import { checkQuota, logEvent } from "@/lib/server/guards.server";
import { selectCandidates, type RoutableModel } from "@/lib/ai/routing";
import { ROUTING_MODES, type RoutingMode } from "@/lib/ai/types";
import { getUserFromRequest } from "@/lib/server/auth.server";
import { loadProviderConn } from "@/lib/server/provider-ops.server";
import { safeErrorCode, startChat, statusFromHttp, type ChatMessage } from "@/lib/server/providers.server";

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1).max(32_000).optional(),
  retry: z.boolean().optional(),
  imageIds: z.array(z.string().uuid()).max(4).optional(),
});

const SYSTEM_PROMPT =
  "You are a senior software engineering assistant. Answer precisely. Use fenced code blocks with language tags for code. Reply in the user's language.";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export async function handleChat(request: Request): Promise<Response> {
        const auth = await getUserFromRequest(request);
        if (!auth) return json(401, { error: "UNAUTHORIZED" });
        const { supabase, userId } = auth;

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return json(400, { error: "BAD_REQUEST" });
        }
        if (!body.content && !body.retry) return json(400, { error: "BAD_REQUEST" });
        const quota = (await checkQuota(userId, "messagesPerDay")) ?? (await checkQuota(userId, "tokensPerDay", 0)) ?? (await checkQuota(userId, "providerSpendPerDayUsd", 0));
        if (quota) return json(429, { error: quota });

        const { data: convo } = await supabase
          .from("conversations")
          .select("id, title, routing_mode, active_model_id")
          .eq("id", body.conversationId)
          .maybeSingle();
        if (!convo) return json(404, { error: "NOT_FOUND" });

        if (body.retry && body.imageIds?.length) return json(400,{error:"BAD_REQUEST"});
        if (body.imageIds?.length) { try { await resolveVisionPreviews(body.imageIds,userId); } catch { return json(400,{error:"INVALID_ATTACHMENT"}); } }
        if (body.retry) {
          // Remove trailing non-user messages (failed/cancelled answer) before regenerating.
          const { data: last } = await supabase
            .from("messages")
            .select("id, role")
            .eq("conversation_id", convo.id)
            .order("created_at", { ascending: false })
            .limit(5);
          const toDelete: string[] = [];
          for (const m of last ?? []) {
            if (m.role === "user") break;
            toDelete.push(m.id);
          }
          if (toDelete.length) await supabase.from("messages").delete().in("id", toDelete);
        } else if (body.content) {
          const inserted = await supabase
            .from("messages")
            .insert({ conversation_id: convo.id, user_id: userId, role: "user", content: body.content, metadata_json: {image_ids:body.imageIds??[]} });
          if(inserted.error) return json(500,{error:"PERSIST_FAILED"});
        }

        const { data: history } = await supabase
          .from("messages")
          .select("role, content, status, metadata_json")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: false })
          .limit(40);
        const messages: ChatMessage[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...(history ?? [])
            .reverse()
            .filter((m) => (m.role === "user" || m.role === "assistant") && m.content && m.status !== "ERROR")
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];
        const firstContent = messages.find((m) => m.role === "user")?.content;
        const firstUser = typeof firstContent === "string" ? firstContent : "";
        const latestUser = [...(history??[])].reverse().find(m=>m.role==="user");
        const meta = latestUser?.metadata_json as {image_ids?:unknown}|null;
        const parsedIds = z.array(z.string().uuid()).max(4).safeParse(meta?.image_ids??[]);
        const imageIds = parsedIds.success ? parsedIds.data : [];
        if(imageIds.length){
          try {
            const parts = await resolveVisionPreviews(imageIds,userId);
            let lastIndex = messages.length-1;
            while(lastIndex>=0 && messages[lastIndex]!.role!=="user")lastIndex--;
            if(lastIndex>=0 && Array.isArray(parts)) messages[lastIndex] = {role:"user",content:[{type:"text",text:String(messages[lastIndex]!.content)},...parts]};
          } catch { return json(409,{error:"ATTACHMENT_UNAVAILABLE"}); }
        }

        // Routing
        const [{ data: pref }, { data: providers }, { data: models }] = await Promise.all([
          supabase.from("routing_preferences").select("mode, preferred_model_id, fallback_enabled").maybeSingle(),
          supabase.from("ai_providers").select("id, status"),
          supabase
            .from("ai_models")
            .select(
              "id, provider_id, external_model_id, display_name, price_class, context_length, status, is_available, capabilities_json, metadata_json",
            )
            .eq("is_available", true)
            .limit(3000),
        ]);
        const mode = (ROUTING_MODES as readonly string[]).includes(convo.routing_mode)
          ? (convo.routing_mode as RoutingMode)
          : ((pref?.mode as RoutingMode) ?? "AUTO");
        const { data: ks } = await supabase.from("kill_switches").select("enabled, target").eq("key", "disable_provider").maybeSingle();
        const providerKillAll = !!ks?.enabled && !ks.target;
        const blockedProviders = new Set(ks?.enabled && ks.target ? [ks.target] : []);
        const candidates = selectCandidates({
          mode,
          models: ((models ?? []) as RoutableModel[]).filter(m=>!imageIds.length || hasCap(m,"vision")),
          providers: (providers ?? []).filter((p) => !blockedProviders.has(p.id) && !providerKillAll),
          preferredModelId: convo.active_model_id ?? pref?.preferred_model_id ?? null,
          fallbackEnabled: pref?.fallback_enabled ?? true,
        });
        if (candidates.length === 0) {
          return json(409, { error: imageIds.length ? "NO_VISION_MODEL_AVAILABLE" : mode === "MANUAL" ? "NO_MODEL_SELECTED" : "NO_MODELS_AVAILABLE" });
        }

        const { data: assistant } = await supabase
          .from("messages")
          .insert({
            conversation_id: convo.id,
            user_id: userId,
            role: "assistant",
            content: "",
            status: "STREAMING",
          })
          .select("id")
          .single();
        if (!assistant) return json(500, { error: "PERSIST_FAILED" });

        const upstreamAbort = new AbortController();
        if (request.signal.aborted) upstreamAbort.abort();
        request.signal.addEventListener("abort", () => upstreamAbort.abort(), { once: true });
        const encoder = new TextEncoder();
        let closed = false;
        let text = "";
        let finalStatus: "COMPLETE" | "ERROR" | "CANCELLED" = "ERROR";
        let used: RoutableModel | null = null;
        const fallbackReasons: { model: string; code: string }[] = [];
        let usage: { prompt_tokens?: number; completion_tokens?: number } | null = null;
        const started = Date.now();

        const persist = async () => {
          await supabase
            .from("messages")
            .update({
              content: text,
              status: finalStatus,
              provider_id: used?.provider_id ?? null,
              model_id: used?.id ?? null,
              metadata_json: {
                model: used?.external_model_id ?? null,
                model_name: used?.display_name ?? null,
                routing_mode: mode,
                fallback: fallbackReasons,
                latency_ms: Date.now() - started,
                ...(finalStatus === "ERROR" ? { error_code: fallbackReasons.at(-1)?.code ?? "UNEXPECTED" } : {}),
              },
            })
            .eq("id", assistant.id).throwOnError();
          await supabase
            .from("conversations")
            .update({
              ...(used ? { active_provider_id: used.provider_id } : {}),
              ...(!convo.title && firstUser ? { title: firstUser.replace(/\s+/g, " ").slice(0, 60) } : {}),
            })
            .eq("id", convo.id).throwOnError();
          await supabase.from("usage_events").insert({
            user_id: userId,
            conversation_id: convo.id,
            provider_id: used?.provider_id ?? null,
            model_id: used?.id ?? null,
            event_type: `chat.${finalStatus.toLowerCase()}`,
            input_tokens: usage?.prompt_tokens ?? null,
            output_tokens: usage?.completion_tokens ?? null,
          }).throwOnError();
          await logEvent({ event: "chat", status: finalStatus === "COMPLETE" ? "OK" : "FAILED", userId, providerId: used?.provider_id ?? null, modelId: used?.external_model_id ?? null, durationMs: Date.now() - started, metadata: { routing_mode: mode, fallback: fallbackReasons } });
        };

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (event: string, data: unknown) => {
              if (closed) return;
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };
            send("start", { messageId: assistant.id, mode });

            for (const model of candidates) {
              if (upstreamAbort.signal.aborted) break;
              let res: Response;
              try {
                const conn = await loadProviderConn(model.provider_id, userId);
                res = await startChat(conn, model.external_model_id, messages, {
                  stream: true,
                  signal: upstreamAbort.signal,
                });
              } catch (e) {
                const code = safeErrorCode(e) === "UNEXPECTED" && e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : safeErrorCode(e);
                if (code === "CANCELLED") break;
                fallbackReasons.push({ model: model.external_model_id, code });
                send("fallback", { model: model.display_name, code });
                continue;
              }
              if (!res.ok || !res.body) {
                const code = res.ok ? "EMPTY_BODY" : statusFromHttp(res.status);
                fallbackReasons.push({ model: model.external_model_id, code });
                send("fallback", { model: model.display_name, code });
                continue;
              }

              used = model;
              send("model", { id: model.id, name: model.display_name, providerId: model.provider_id });
              const reader = res.body.getReader();
              const decoder = new TextDecoder();
              let buffer = "";
              let gotAny = false;
              try {
                while (true) {
                  const { value, done } = await reader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });
                  let idx: number;
                  while ((idx = buffer.indexOf("\n")) !== -1) {
                    const line = buffer.slice(0, idx).trim();
                    buffer = buffer.slice(idx + 1);
                    if (!line.startsWith("data:")) continue;
                    const payload = line.slice(5).trim();
                    if (payload === "[DONE]") continue;
                    try {
                      const chunk = JSON.parse(payload) as {
                        choices?: { delta?: { content?: string } }[];
                        usage?: typeof usage;
                        error?: unknown;
                      };
                      if (chunk.error) throw new Error("UPSTREAM_ERROR");
                      const delta = chunk.choices?.[0]?.delta?.content;
                      if (delta) {
                        gotAny = true;
                        text += delta;
                        send("delta", { text: delta });
                      }
                      if (chunk.usage) usage = chunk.usage;
                    } catch (e) {
                      if (e instanceof Error && e.message === "UPSTREAM_ERROR") throw e;
                    }
                  }
                }
                if (!gotAny && !text) {
                  // Model returned no content: count as failure, allow bounded fallback.
                  fallbackReasons.push({ model: model.external_model_id, code: "EMPTY_RESPONSE" });
                  send("fallback", { model: model.display_name, code: "EMPTY_RESPONSE" });
                  used = null;
                  continue;
                }
                finalStatus = "COMPLETE";
              } catch (e) {
                if (upstreamAbort.signal.aborted) {
                  finalStatus = "CANCELLED";
                } else {
                  finalStatus = "ERROR";
                  fallbackReasons.push({
                    model: model.external_model_id,
                    code: e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : safeErrorCode(e),
                  });
                }
              }
              break; // never fall back after streaming has started
            }

            if (upstreamAbort.signal.aborted && finalStatus !== "COMPLETE") finalStatus = "CANCELLED";
            try { await persist(); } catch {
              finalStatus = "ERROR";
              fallbackReasons.push({model:used?.external_model_id ?? "",code:"PERSIST_FAILED"});
            }
            if (finalStatus === "COMPLETE") send("done", { messageId: assistant.id });
            else if (finalStatus === "ERROR") send("error", { code: fallbackReasons.at(-1)?.code ?? "UNEXPECTED" });
            if (!closed) {
              closed = true;
              controller.close();
            }
          },
          cancel() {
            closed = true;
            upstreamAbort.abort();
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-store, no-transform",
            "x-accel-buffering": "no",
          },
        });

}
