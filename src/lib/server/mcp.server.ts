// MCP client over Streamable HTTP (server-side only), with OAuth 2.1 (PKCE, state,
// issuer validation, refresh). All outbound calls go through safeFetch (SSRF guard).
import { redactValue } from "@/lib/security/redact";
import { safeFetch, OutboundError } from "./outbound.server";
import { loadMcpCredential, storeMcpCredential } from "./secrets.server";

const PROTOCOL_VERSION = "2025-06-18";

export class McpError extends Error {
  constructor(
    public code: string,
    public extra?: Record<string, string>,
  ) {
    super(code);
  }
}

interface RpcResult {
  result?: unknown;
  error?: { code: number; message: string };
}

async function parseRpcResponse(res: Response, id: number): Promise<RpcResult> {
  const ct = res.headers.get("content-type") ?? "";
  const text = (await res.text()).slice(0, 2_000_000);
  if (ct.includes("text/event-stream")) {
    for (const block of text.split(/\n\n/)) {
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("\n");
      if (!data) continue;
      try {
        const msg = JSON.parse(data) as RpcResult & { id?: number };
        if (msg.id === id) return msg;
      } catch {
        /* ignore */
      }
    }
    throw new McpError("INVALID_RESPONSE");
  }
  try {
    return JSON.parse(text) as RpcResult;
  } catch {
    throw new McpError("INVALID_RESPONSE");
  }
}

export interface McpSession {
  url: string;
  token: string | null;
  sessionId: string | null;
  nextId: number;
}

async function rpc(s: McpSession, method: string, params?: unknown, notify = false): Promise<unknown> {
  const id = s.nextId++;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": PROTOCOL_VERSION,
  };
  if (s.token) headers["authorization"] = `Bearer ${s.token}`;
  if (s.sessionId) headers["mcp-session-id"] = s.sessionId;
  let res: Response;
  try {
    res = await safeFetch(s.url, {
      method: "POST",
      headers,
      body: JSON.stringify(notify ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id, method, params }),
      timeoutMs: 30_000,
    });
  } catch (e) {
    throw new McpError(e instanceof OutboundError ? e.code : "NETWORK_ERROR");
  }
  if (res.status === 401) {
    const www = res.headers.get("www-authenticate") ?? "";
    const meta = /resource_metadata="([^"]+)"/.exec(www)?.[1];
    throw new McpError("AUTH_REQUIRED", meta ? { resource_metadata: meta } : {});
  }
  if (res.status === 403) throw new McpError("FORBIDDEN");
  const sid = res.headers.get("mcp-session-id");
  if (sid) s.sessionId = sid;
  if (notify) return null;
  if (!res.ok) throw new McpError(`HTTP_${res.status}`);
  const msg = await parseRpcResponse(res, id);
  if (msg.error) throw new McpError("RPC_ERROR", { message: String(msg.error.message).slice(0, 200) });
  return msg.result;
}

export async function connect(url: string, token: string | null): Promise<{ session: McpSession; serverInfo: unknown; capabilities: Record<string, unknown> }> {
  const session: McpSession = { url, token, sessionId: null, nextId: 1 };
  const init = (await rpc(session, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "wakeel-agent", version: "0.2.0" },
  })) as { serverInfo?: unknown; capabilities?: Record<string, unknown> };
  await rpc(session, "notifications/initialized", undefined, true);
  return { session, serverInfo: init?.serverInfo ?? null, capabilities: init?.capabilities ?? {} };
}

export async function discover(session: McpSession, capabilities: Record<string, unknown>) {
  const tools = (await rpc(session, "tools/list", {}).catch(() => ({ tools: [] }))) as { tools?: { name: string; description?: string; inputSchema?: unknown }[] };
  const resources = capabilities["resources"]
    ? ((await rpc(session, "resources/list", {}).catch(() => ({ resources: [] }))) as { resources?: { uri: string; name?: string; description?: string; mimeType?: string }[] })
    : { resources: [] };
  const prompts = capabilities["prompts"]
    ? ((await rpc(session, "prompts/list", {}).catch(() => ({ prompts: [] }))) as { prompts?: { name: string; description?: string; arguments?: unknown[] }[] })
    : { prompts: [] };
  return { tools: tools.tools ?? [], resources: resources.resources ?? [], prompts: prompts.prompts ?? [] };
}

export async function callTool(session: McpSession, name: string, args: Record<string, unknown>) {
  const result = await rpc(session, "tools/call", { name, arguments: args });
  return redactValue(result); // output sanitizer before model/client display
}

// ---------------- OAuth ----------------

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(len = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(len)));
}

export async function pkceChallenge(verifier: string) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

interface AsMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
  scopes_supported?: string[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await safeFetch(url, { headers: { accept: "application/json" }, timeoutMs: 10_000 });
  if (!res.ok) throw new McpError(`HTTP_${res.status}`);
  return (await res.json()) as T;
}

/** Discovers the authorization server for an MCP server (RFC 9728 + RFC 8414) and validates issuer. */
export async function discoverAuthServer(serverUrl: string, resourceMetadataUrl?: string): Promise<{ meta: AsMetadata; scopes: string[] }> {
  const origin = new URL(serverUrl).origin;
  let issuer = origin;
  let scopes: string[] = [];
  try {
    const prm = await getJson<{ authorization_servers?: string[]; scopes_supported?: string[] }>(
      resourceMetadataUrl ?? `${origin}/.well-known/oauth-protected-resource`,
    );
    if (prm.authorization_servers?.[0]) issuer = prm.authorization_servers[0];
    scopes = prm.scopes_supported ?? [];
  } catch {
    /* fall back to server origin as issuer */
  }
  const iss = new URL(issuer);
  const path = iss.pathname.replace(/\/+$/, "");
  const candidates = [
    `${iss.origin}/.well-known/oauth-authorization-server${path}`,
    `${iss.origin}/.well-known/openid-configuration${path}`,
    `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`,
  ];
  for (const c of candidates) {
    try {
      const meta = await getJson<AsMetadata>(c);
      if (meta.issuer?.replace(/\/+$/, "") !== issuer.replace(/\/+$/, "")) throw new McpError("ISSUER_MISMATCH");
      if (meta.code_challenge_methods_supported && !meta.code_challenge_methods_supported.includes("S256")) throw new McpError("PKCE_UNSUPPORTED");
      return { meta, scopes: scopes.length ? scopes : (meta.scopes_supported ?? []) };
    } catch (e) {
      if (e instanceof McpError && (e.code === "ISSUER_MISMATCH" || e.code === "PKCE_UNSUPPORTED")) throw e;
    }
  }
  throw new McpError("OAUTH_DISCOVERY_FAILED");
}

export async function registerClient(meta: AsMetadata, redirectUri: string): Promise<{ client_id: string; client_secret?: string }> {
  if (!meta.registration_endpoint) throw new McpError("DCR_UNSUPPORTED");
  const res = await safeFetch(meta.registration_endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_name: "Wakeel Agent",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
    timeoutMs: 10_000,
  });
  if (!res.ok) throw new McpError("DCR_FAILED");
  const j = (await res.json()) as { client_id?: string; client_secret?: string };
  if (!j.client_id) throw new McpError("DCR_FAILED");
  return { client_id: j.client_id, ...(j.client_secret ? { client_secret: j.client_secret } : {}) };
}

export async function exchangeToken(
  tokenEndpoint: string,
  params: Record<string, string>,
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }> {
  const res = await safeFetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(params).toString(),
    timeoutMs: 15_000,
  });
  if (!res.ok) throw new McpError("TOKEN_EXCHANGE_FAILED");
  const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string };
  if (!j.access_token) throw new McpError("TOKEN_EXCHANGE_FAILED");
  return { access_token: j.access_token, ...(j.refresh_token ? { refresh_token: j.refresh_token } : {}), ...(j.expires_in ? { expires_in: j.expires_in } : {}), ...(j.scope ? { scope: j.scope } : {}) };
}

/** Returns a usable bearer token, refreshing an expired OAuth token when possible. */
export async function resolveToken(serverId: string, userId: string): Promise<string | null> {
  const cred = await loadMcpCredential(serverId, userId);
  if (!cred) return null;
  if (cred.type === "BEARER") return cred.access_token;
  const expired = cred.expires_at && new Date(cred.expires_at).getTime() < Date.now() + 60_000;
  if (!expired) return cred.access_token;
  if (!cred.refresh_token || !cred.token_endpoint || !cred.client_id) throw new McpError("AUTH_REQUIRED");
  const t = await exchangeToken(cred.token_endpoint, {
    grant_type: "refresh_token",
    refresh_token: cred.refresh_token,
    client_id: cred.client_id,
    ...(cred.client_secret ? { client_secret: cred.client_secret } : {}),
  });
  await storeMcpCredential(
    serverId,
    userId,
    { ...cred, access_token: t.access_token, refresh_token: t.refresh_token ?? cred.refresh_token },
    { scopes: t.scope ?? null, expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null },
  );
  return t.access_token;
}
