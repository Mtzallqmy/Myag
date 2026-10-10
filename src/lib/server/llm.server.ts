// Non-streaming model completion using the user's routing preferences and bounded fallback.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { selectCandidates, type RoutableModel } from "@/lib/ai/routing";
import type { RoutingMode } from "@/lib/ai/types";
import { killSwitchOn } from "./guards.server";
import { loadProviderConn } from "./provider-ops.server";
import { safeErrorCode, startChat, statusFromHttp, type ChatMessage } from "./providers.server";

export class LlmError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export async function completeWithRouting(
  supabase: SupabaseClient<Database>,
  userId: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; modeOverride?: RoutingMode } = {},
): Promise<{ text: string; model: string; modelId: string; providerId: string; fallback: { model: string; code: string }[] }> {
  const [{ data: pref }, { data: providers }, { data: models }] = await Promise.all([
    supabase.from("routing_preferences").select("mode, preferred_model_id, fallback_enabled").maybeSingle(),
    supabase.from("ai_providers").select("id, status"),
    supabase
      .from("ai_models")
      .select("id, provider_id, external_model_id, display_name, price_class, context_length, status, is_available, capabilities_json, metadata_json")
      .eq("is_available", true)
      .limit(3000),
  ]);
  const candidates = selectCandidates({
    mode: opts.modeOverride ?? ((pref?.mode as RoutingMode) ?? "AUTO"),
    models: (models ?? []) as RoutableModel[],
    providers: providers ?? [],
    preferredModelId: pref?.preferred_model_id ?? null,
    fallbackEnabled: pref?.fallback_enabled ?? true,
  });
  if (!candidates.length) throw new LlmError("NO_MODELS_AVAILABLE");
  const fallback: { model: string; code: string }[] = [];
  for (const m of candidates) {
    try {
      if (await killSwitchOn("disable_provider", m.provider_id)) { fallback.push({ model: m.external_model_id, code: "KILL_SWITCH" }); continue; }
      const conn = await loadProviderConn(m.provider_id, userId);
      const res = await startChat(conn, m.external_model_id, messages, { stream: false, maxTokens: opts.maxTokens ?? 4000 });
      if (!res.ok) {
        fallback.push({ model: m.external_model_id, code: statusFromHttp(res.status) });
        continue;
      }
      const json = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
      const text = json?.choices?.[0]?.message?.content;
      if (!text) {
        fallback.push({ model: m.external_model_id, code: "EMPTY_RESPONSE" });
        continue;
      }
      await supabase.from("usage_events").insert({
        user_id: userId,
        provider_id: m.provider_id,
        model_id: m.id,
        event_type: "agent.completion",
      });
      return { text, model: m.display_name, modelId: m.id, providerId: m.provider_id, fallback };
    } catch (e) {
      fallback.push({ model: m.external_model_id, code: safeErrorCode(e) });
    }
  }
  throw new LlmError(fallback.at(-1)?.code ?? "UNEXPECTED");
}

/** Extracts the first JSON object from model output (tolerates code fences). */
export function extractJson<T = unknown>(text: string): T | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
