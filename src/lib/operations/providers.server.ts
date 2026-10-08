// Provider gateway server functions (create/update/delete/test/refresh/model-test).
import { defineOperation } from "./operation";
import { z } from "zod";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";
import { normalizeBaseUrl, validateOutboundUrl } from "@/lib/ai/url-guard";
import { PROVIDER_TYPES } from "@/lib/ai/types";
import { tokenHint, CURRENT_KEY_VERSION } from "@/lib/server/crypto.server";
import { assertPublicUrl, OutboundError } from "@/lib/server/outbound.server";
import { checkAndDiscover, loadProviderConn, storeProviderSecret } from "@/lib/server/provider-ops.server";
import { safeErrorCode, startChat, statusFromHttp } from "@/lib/server/providers.server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const baseUrlSchema = z.string().trim().min(8).max(500);
const tokenSchema = z.string().trim().min(8).max(4000);

async function validateBase(raw: string): Promise<string> {
  const v = validateOutboundUrl(raw);
  if (!v.ok) throw new OutboundError(v.error);
  const normalized = normalizeBaseUrl(raw);
  await assertPublicUrl(normalized);
  return normalized;
}

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof OutboundError) return { ok: false, error: e.code };
  const msg = e instanceof Error ? e.message : "";
  if (/^[A-Z_]+$/.test(msg)) return { ok: false, error: msg };
  console.error("[provider] unexpected error", e instanceof Error ? e.name : typeof e);
  return { ok: false, error: "UNEXPECTED" };
}

export const createProvider = defineOperation({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        providerType: z.enum(PROVIDER_TYPES),
        baseUrl: baseUrlSchema,
        token: tokenSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Result<{ id: string; status: string; modelCount: number; code: string | null }>> => {
    try {
      const baseUrl = await validateBase(data.baseUrl);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("ai_providers")
        .insert({
          user_id: context.userId,
          name: data.name,
          provider_type: data.providerType,
          base_url: baseUrl,
          token_hint: tokenHint(data.token),
          encrypted_secret_ref: `provider_secrets:${CURRENT_KEY_VERSION}`,
          status: "CHECKING",
        })
        .select("id")
        .single();
      if (error || !row) return { ok: false, error: "CREATE_FAILED" };
      await storeProviderSecret(row.id, context.userId, data.token);
      await supabaseAdmin.from("audit_logs").insert({
        user_id: context.userId,
        action: "provider.create",
        entity_type: "ai_provider",
        entity_id: row.id,
        metadata_json: { provider_type: data.providerType, host: new URL(baseUrl).host },
      });
      const r = await checkAndDiscover(row.id, context.userId);
      return { ok: true, data: { id: row.id, status: r.status, modelCount: r.modelCount, code: r.code } };
    } catch (e) {
      return fail(e);
    }
  });

export const updateProvider = defineOperation({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(80).optional(),
        providerType: z.enum(PROVIDER_TYPES).optional(),
        baseUrl: baseUrlSchema.optional(),
        token: tokenSchema.optional(),
        disabled: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Result<{ status: string }>> => {
    try {
      const { data: owned } = await context.supabase.from("ai_providers").select("id").eq("id", data.id).maybeSingle();
      if (!owned) return { ok: false, error: "PROVIDER_NOT_FOUND" };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const patch: TablesUpdate<"ai_providers"> = {};
      if (data.name) patch.name = data.name;
      if (data.providerType) patch.provider_type = data.providerType;
      if (data.baseUrl) patch.base_url = await validateBase(data.baseUrl);
      if (data.token) {
        await storeProviderSecret(data.id, context.userId, data.token);
        patch.token_hint = tokenHint(data.token);
        patch.encrypted_secret_ref = `provider_secrets:${CURRENT_KEY_VERSION}`;
      }
      if (data.disabled !== undefined) patch.status = data.disabled ? "DISABLED" : "UNKNOWN";
      if (Object.keys(patch).length) {
        await supabaseAdmin.from("ai_providers").update(patch).eq("id", data.id).eq("user_id", context.userId);
      }
      await supabaseAdmin.from("audit_logs").insert({
        user_id: context.userId,
        action: "provider.update",
        entity_type: "ai_provider",
        entity_id: data.id,
        metadata_json: { fields: Object.keys(patch).filter((k) => k !== "token_hint") },
      });
      if (data.disabled === true) return { ok: true, data: { status: "DISABLED" } };
      if (data.baseUrl || data.token || data.providerType || data.disabled === false) {
        const r = await checkAndDiscover(data.id, context.userId);
        return { ok: true, data: { status: r.status } };
      }
      return { ok: true, data: { status: "UNCHANGED" } };
    } catch (e) {
      return fail(e);
    }
  });

export const deleteProvider = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<null>> => {
    const { error } = await context.supabase.from("ai_providers").delete().eq("id", data.id);
    if (error) return { ok: false, error: "DELETE_FAILED" };
    await context.supabase.from("audit_logs").insert({
      user_id: context.userId,
      action: "provider.delete",
      entity_type: "ai_provider",
      entity_id: data.id,
    });
    return { ok: true, data: null };
  });

export const testProvider = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<{ status: string; modelCount: number; code: string | null; latencyMs: number }>> => {
    try {
      const { data: owned } = await context.supabase
        .from("ai_providers")
        .select("id, status")
        .eq("id", data.id)
        .maybeSingle();
      if (!owned) return { ok: false, error: "PROVIDER_NOT_FOUND" };
      if (owned.status === "DISABLED") return { ok: false, error: "PROVIDER_DISABLED" };
      const r = await checkAndDiscover(data.id, context.userId);
      return { ok: true, data: r };
    } catch (e) {
      return fail(e);
    }
  });

export const testModel = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ modelId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<{ status: string; latencyMs: number; code: string | null }>> => {
    try {
      const { data: model } = await context.supabase
        .from("ai_models")
        .select("id, provider_id, external_model_id, metadata_json, capabilities_json")
        .eq("id", data.modelId)
        .maybeSingle();
      if (!model) return { ok: false, error: "MODEL_NOT_FOUND" };
      const conn = await loadProviderConn(model.provider_id, context.userId);
      const started = Date.now();
      let status = "FAILED";
      let code: string | null = null;
      try {
        const res = await startChat(conn, model.external_model_id, [{ role: "user", content: "ping" }], {
          stream: false,
          maxTokens: 8,
        });
        if (res.ok) {
          const json = (await res.json().catch(() => null)) as { choices?: unknown[] } | null;
          if (json && Array.isArray(json.choices)) status = "ONLINE";
          else code = "INVALID_RESPONSE";
        } else {
          code = statusFromHttp(res.status);
        }
      } catch (e) {
        code = safeErrorCode(e);
      }
      const latencyMs = Date.now() - started;
      const meta = { ...((model.metadata_json ?? {}) as Record<string, unknown>) };
      if (status === "ONLINE") meta["latency_ms"] = latencyMs;
      meta["last_test_code"] = code;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("ai_models")
        .update({ status, metadata_json: meta as Json, last_checked_at: new Date().toISOString() })
        .eq("id", model.id)
        .eq("user_id", context.userId);
      return { ok: true, data: { status, latencyMs, code } };
    } catch (e) {
      return fail(e);
    }
  });
