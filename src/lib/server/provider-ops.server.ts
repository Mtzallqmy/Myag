// Privileged provider operations. Callers MUST verify ownership with the user-scoped
// client before calling these helpers.
import type { ProviderType } from "@/lib/ai/types";
import { decryptSecret, encryptSecret } from "./crypto.server";
import { listModels, type ProviderConn } from "./providers.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const aadFor = (providerId: string, userId: string) => `${providerId}:${userId}`;

export async function storeProviderSecret(providerId: string, userId: string, token: string) {
  const db = await admin();
  const { version, ciphertext } = await encryptSecret(token, aadFor(providerId, userId));
  const { error } = await db
    .from("provider_secrets")
    .upsert({ provider_id: providerId, user_id: userId, key_version: version, ciphertext }, { onConflict: "provider_id" });
  if (error) throw new Error("SECRET_STORE_FAILED");
  return version;
}

export async function loadProviderConn(providerId: string, userId: string): Promise<ProviderConn> {
  const db = await admin();
  const { data: p } = await db
    .from("ai_providers")
    .select("id, user_id, base_url, provider_type")
    .eq("id", providerId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!p) throw new Error("PROVIDER_NOT_FOUND");
  const { data: s } = await db
    .from("provider_secrets")
    .select("ciphertext, key_version")
    .eq("provider_id", providerId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!s) throw new Error("SECRET_MISSING");
  const token = await decryptSecret(s.ciphertext, aadFor(providerId, userId), s.key_version);
  return { baseUrl: p.base_url, providerType: p.provider_type as ProviderType, token };
}

/** Tests provider reachability + auth, discovers models, persists status/health/models. */
export async function checkAndDiscover(providerId: string, userId: string) {
  const db = await admin();
  const conn = await loadProviderConn(providerId, userId);
  const result = await listModels(conn);
  const now = new Date().toISOString();

  await db.from("provider_health_checks").insert({
    user_id: userId,
    provider_id: providerId,
    status: result.ok ? "ONLINE" : result.status,
    latency_ms: result.latencyMs,
    safe_error_code: result.ok ? null : result.code,
  });

  if (!result.ok) {
    await db.from("ai_providers").update({ status: result.status, last_checked_at: now }).eq("id", providerId);
    return { status: result.status, code: result.code, modelCount: 0, latencyMs: result.latencyMs };
  }

  const status = result.models.length === 0 ? "DEGRADED" : "ONLINE";
  await db.from("ai_providers").update({ status, last_checked_at: now }).eq("id", providerId);

  // Upsert discovered models without clobbering test results (status/latency).
  const { data: existing } = await db
    .from("ai_models")
    .select("id, external_model_id, status, metadata_json")
    .eq("provider_id", providerId);
  const byId = new Map((existing ?? []).map((m) => [m.external_model_id, m]));
  const rows = result.models.map((m) => {
    const prev = byId.get(m.external_model_id);
    const prevMeta = (prev?.metadata_json ?? {}) as Record<string, unknown>;
    return {
      provider_id: providerId,
      user_id: userId,
      external_model_id: m.external_model_id,
      display_name: m.display_name,
      price_class: m.price_class,
      context_length: m.context_length,
      capabilities_json: { ...m.capabilities, ...(prevMeta["streaming_verified"] ? { streaming: "SUPPORTED" } : {}) },
      metadata_json: {
        ...m.metadata,
        ...(typeof prevMeta["latency_ms"] === "number" ? { latency_ms: prevMeta["latency_ms"] } : {}),
        ...(prevMeta["streaming_verified"] ? { streaming_verified: true } : {}),
      },
      is_available: true,
      status: prev?.status ?? "UNKNOWN",
      last_checked_at: now,
    };
  });
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db
      .from("ai_models")
      .upsert(rows.slice(i, i + 500), { onConflict: "provider_id,external_model_id" });
    if (error) throw new Error("MODEL_UPSERT_FAILED");
  }
  const seen = new Set(result.models.map((m) => m.external_model_id));
  const gone = (existing ?? []).filter((m) => !seen.has(m.external_model_id)).map((m) => m.id);
  if (gone.length) await db.from("ai_models").update({ is_available: false }).in("id", gone);

  return { status, code: null, modelCount: rows.length, latencyMs: result.latencyMs };
}
