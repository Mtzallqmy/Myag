// MCP server management: add, connect/discover, OAuth start, tool enablement, tool calls.
import { defineOperation } from "./operation";
import { z } from "zod";
import { checkQuota, flagOn, killSwitchOn } from "@/lib/server/guards.server";
import { validateOutboundUrl } from "@/lib/ai/url-guard";
import { classifyMcpTool, defaultToolState, type RiskLevel } from "@/lib/agent/policy";
import { assertPublicUrl, OutboundError } from "@/lib/server/outbound.server";
import { encryptSmall, storeMcpCredential } from "@/lib/server/secrets.server";
import { callTool, connect, discover, discoverAuthServer, McpError, pkceChallenge, randomToken, registerClient, resolveToken } from "@/lib/server/mcp.server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
const errCode = (e: unknown) => (e instanceof McpError || e instanceof OutboundError ? e.code : e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : "UNEXPECTED");

async function refreshServer(serverId: string, userId: string) {
  const db = await admin();
  const { data: s } = await db.from("mcp_servers").select("*").eq("id", serverId).eq("user_id", userId).single();
  if (!s) throw new Error("NOT_FOUND");
  try {
    const token = await resolveToken(serverId, userId);
    const { session, serverInfo, capabilities } = await connect(s.url, token);
    const found = await discover(session, capabilities);
    const { data: existing } = await db.from("mcp_tools").select("name, enabled, approval_required, risk_level").eq("server_id", serverId);
    const prev = new Map((existing ?? []).map((t) => [t.name, t]));
    const tools = found.tools.slice(0, 300).map((t) => {
      const risk = classifyMcpTool(t.name, t.description ?? "");
      const p = prev.get(t.name);
      const defaults = defaultToolState(risk);
      return {
        server_id: serverId,
        user_id: userId,
        name: t.name.slice(0, 200),
        description: (t.description ?? "").slice(0, 2000),
        input_schema_json: (t.inputSchema ?? {}) as never,
        risk_level: risk,
        // keep user choices, but a tool reclassified as CRITICAL is force-disabled
        enabled: risk === "CRITICAL" ? false : (p?.enabled ?? defaults.enabled),
        approval_required: risk === "LOW" ? (p?.approval_required ?? defaults.approval_required) : true,
      };
    });
    if (tools.length) await db.from("mcp_tools").upsert(tools, { onConflict: "server_id,name" });
    const names = new Set(tools.map((t) => t.name));
    const gone = (existing ?? []).filter((t) => !names.has(t.name)).map((t) => t.name);
    if (gone.length) await db.from("mcp_tools").delete().eq("server_id", serverId).in("name", gone);
    await db.from("mcp_resources").delete().eq("server_id", serverId);
    if (found.resources.length)
      await db.from("mcp_resources").insert(found.resources.slice(0, 300).map((r) => ({ server_id: serverId, user_id: userId, uri: r.uri.slice(0, 1000), name: r.name ?? null, description: r.description?.slice(0, 1000) ?? null, mime_type: r.mimeType ?? null })));
    await db.from("mcp_prompts").delete().eq("server_id", serverId);
    if (found.prompts.length)
      await db.from("mcp_prompts").insert(found.prompts.slice(0, 300).map((p) => ({ server_id: serverId, user_id: userId, name: p.name.slice(0, 200), description: p.description?.slice(0, 1000) ?? null, arguments_json: (p.arguments ?? []) as never })));
    await db.from("mcp_servers").update({ status: "CONNECTED", server_info_json: (serverInfo ?? {}) as never, last_error_code: null, last_checked_at: new Date().toISOString() }).eq("id", serverId);
    return { status: "CONNECTED", tools: tools.length };
  } catch (e) {
    const code = errCode(e);
    const status = code === "AUTH_REQUIRED" ? "AUTH_REQUIRED" : "ERROR";
    const meta = e instanceof McpError && e.extra?.["resource_metadata"] ? { resource_metadata: e.extra["resource_metadata"] } : {};
    await db.from("mcp_servers").update({ status, last_error_code: code, last_checked_at: new Date().toISOString(), ...(Object.keys(meta).length ? { oauth_metadata_json: meta as never } : {}) }).eq("id", serverId);
    return { status, tools: 0, code };
  }
}

export const addMcpServer = defineOperation({ method: "POST" })
  .inputValidator((d) =>
    z.object({ name: z.string().trim().min(1).max(80), url: z.string().trim().min(10).max(500), bearer: z.string().trim().min(8).max(4000).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Result<{ id: string; status: string; tools: number; code?: string }>> => {
    const quota = await checkQuota(context.userId, "mcpServers");
    if (quota) return { ok: false, error: quota };
    try {
      const v = validateOutboundUrl(data.url);
      if (!v.ok) return { ok: false, error: v.error };
      await assertPublicUrl(data.url);
      const db = await admin();
      const { data: s } = await db
        .from("mcp_servers")
        .insert({ user_id: context.userId, name: data.name, url: v.url.toString(), auth_type: data.bearer ? "BEARER" : "NONE" })
        .select("id")
        .single();
      if (!s) return { ok: false, error: "CREATE_FAILED" };
      if (data.bearer) await storeMcpCredential(s.id, context.userId, { type: "BEARER", access_token: data.bearer });
      await db.from("audit_logs").insert({ user_id: context.userId, action: "MCP_SERVER_ADDED", entity_type: "mcp_server", entity_id: s.id, metadata_json: { host: v.url.host } });
      await db.from("integration_registry").upsert({ user_id: context.userId, integration_key: "custom_mcp", status: "CONNECTED", metadata_json: {} }, { onConflict: "user_id,integration_key" });
      const r = await refreshServer(s.id, context.userId);
      return { ok: true, data: { id: s.id, ...r } };
    } catch (e) {
      return { ok: false, error: errCode(e) };
    }
  });

export const refreshMcpServer = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ serverId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<{ status: string; tools: number; code?: string }>> => {
    const { data: s } = await context.supabase.from("mcp_servers").select("id").eq("id", data.serverId).maybeSingle();
    if (!s) return { ok: false, error: "NOT_FOUND" };
    try {
      return { ok: true, data: await refreshServer(s.id, context.userId) };
    } catch (e) {
      return { ok: false, error: errCode(e) };
    }
  });

/** Starts OAuth (PKCE + state). Returns the authorization URL; tokens never reach the browser. */
export const startMcpOAuth = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ serverId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<{ authorizeUrl: string }>> => {
    const { data: s } = await context.supabase.from("mcp_servers").select("id, url, oauth_metadata_json").eq("id", data.serverId).maybeSingle();
    if (!s) return { ok: false, error: "NOT_FOUND" };
    try {
      const origin = new URL(context.request?.url ?? process.env["PUBLIC_API_ORIGIN"] ?? "https://invalid.example").origin;
      const redirectUri = `${origin}/api/public/mcp-oauth/callback`;
      const rm = (s.oauth_metadata_json as { resource_metadata?: string })?.resource_metadata;
      const { meta, scopes } = await discoverAuthServer(s.url, rm);
      const client = await registerClient(meta, redirectUri);
      const verifier = randomToken(48);
      const state = randomToken(32);
      const scope = scopes.join(" ") || undefined;
      const db = await admin();
      await db.from("mcp_oauth_states").insert({
        state,
        user_id: context.userId,
        server_id: s.id,
        code_verifier_enc: await encryptSmall(verifier, `pkce:${state}`),
        issuer: meta.issuer,
        token_endpoint: meta.token_endpoint,
        client_id: client.client_id,
        client_secret_enc: client.client_secret ? await encryptSmall(client.client_secret, `client:${state}`) : null,
        redirect_uri: redirectUri,
        scope: scope ?? null,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      await db.from("mcp_servers").update({ auth_type: "OAUTH" }).eq("id", s.id);
      const u = new URL(meta.authorization_endpoint);
      if (u.protocol !== "https:") return { ok: false, error: "PROTOCOL_NOT_ALLOWED" };
      u.searchParams.set("response_type", "code");
      u.searchParams.set("client_id", client.client_id);
      u.searchParams.set("redirect_uri", redirectUri);
      u.searchParams.set("state", state);
      u.searchParams.set("code_challenge", await pkceChallenge(verifier));
      u.searchParams.set("code_challenge_method", "S256");
      u.searchParams.set("resource", s.url);
      if (scope) u.searchParams.set("scope", scope);
      return { ok: true, data: { authorizeUrl: u.toString() } };
    } catch (e) {
      return { ok: false, error: errCode(e) };
    }
  });

export const setMcpToolState = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ toolId: z.string().uuid(), enabled: z.boolean(), approvalRequired: z.boolean(), confirmCritical: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<null>> => {
    const { data: t } = await context.supabase.from("mcp_tools").select("id, risk_level").eq("id", data.toolId).maybeSingle();
    if (!t) return { ok: false, error: "NOT_FOUND" };
    const risk = t.risk_level as RiskLevel;
    if (risk === "CRITICAL" && data.enabled && !data.confirmCritical) return { ok: false, error: "CRITICAL_CONFIRM_REQUIRED" };
    // Only LOW tools may run without approval.
    const approval = risk === "LOW" ? data.approvalRequired : true;
    const db = await admin();
    await db.from("mcp_tools").update({ enabled: data.enabled, approval_required: approval }).eq("id", t.id);
    return { ok: true, data: null };
  });

/** Manual tool call from the UI (user is the approver). Disabled tools never run. */
export const callMcpTool = defineOperation({ method: "POST" })
  .inputValidator((d) => z.object({ toolId: z.string().uuid(), args: z.record(z.unknown()), confirmed: z.boolean() }).parse(d))
  .handler(async ({ data, context }): Promise<Result<{ output: string }>> => {
    const { data: t } = await context.supabase.from("mcp_tools").select("id, name, server_id, enabled, approval_required, risk_level").eq("id", data.toolId).maybeSingle();
    if (!t) return { ok: false, error: "NOT_FOUND" };
    if (!t.enabled) return { ok: false, error: "TOOL_DISABLED" };
    if (t.approval_required && !data.confirmed) return { ok: false, error: "APPROVAL_REQUIRED" };
    if (t.risk_level !== "LOW") {
      if (await killSwitchOn("disable_mcp_writes")) return { ok: false, error: "KILL_SWITCH" };
      if (!(await flagOn("mcp_write_tools", context.userId))) return { ok: false, error: "FEATURE_DISABLED" };
    }
    const { data: s } = await context.supabase.from("mcp_servers").select("id, url").eq("id", t.server_id).single();
    if (!s) return { ok: false, error: "NOT_FOUND" };
    try {
      const token = await resolveToken(s.id, context.userId);
      const { session } = await connect(s.url, token);
      const output = await callTool(session, t.name, data.args);
      const db = await admin();
      await db.from("audit_logs").insert({ user_id: context.userId, action: "MCP_TOOL_CALLED", entity_type: "mcp_tool", entity_id: t.id, metadata_json: { tool: t.name, risk: t.risk_level } });
      return { ok: true, data: { output: JSON.stringify(output, null, 2).slice(0, 200_000) } };
    } catch (e) {
      return { ok: false, error: errCode(e) };
    }
  });
