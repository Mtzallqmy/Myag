// Helpers for storing integration credentials encrypted (GitHub / MCP).
import { decryptSecret, encryptSecret } from "./crypto.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function storeGithubToken(connectionId: string, userId: string, token: string) {
  const db = await admin();
  const { version, ciphertext } = await encryptSecret(token, `github:${connectionId}:${userId}`);
  const { error } = await db
    .from("github_credentials")
    .upsert({ connection_id: connectionId, user_id: userId, key_version: version, ciphertext }, { onConflict: "connection_id" });
  if (error) throw new Error("SECRET_STORE_FAILED");
}

export async function loadGithubToken(connectionId: string, userId: string): Promise<string> {
  const db = await admin();
  const { data } = await db
    .from("github_credentials")
    .select("ciphertext, key_version")
    .eq("connection_id", connectionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("SECRET_MISSING");
  return decryptSecret(data.ciphertext, `github:${connectionId}:${userId}`, data.key_version);
}

export interface McpCredential {
  type: "BEARER" | "OAUTH";
  access_token: string;
  refresh_token?: string;
  token_endpoint?: string;
  client_id?: string;
  client_secret?: string;
}

export async function storeMcpCredential(serverId: string, userId: string, cred: McpCredential, extra: { scopes?: string | null; expiresAt?: string | null } = {}) {
  const db = await admin();
  const { version, ciphertext } = await encryptSecret(JSON.stringify(cred), `mcp:${serverId}:${userId}`);
  const { error } = await db.from("mcp_credentials").upsert(
    {
      server_id: serverId,
      user_id: userId,
      credential_type: cred.type,
      key_version: version,
      ciphertext,
      scopes: extra.scopes ?? null,
      expires_at: extra.expiresAt ?? null,
    },
    { onConflict: "server_id" },
  );
  if (error) throw new Error("SECRET_STORE_FAILED");
}

export async function loadMcpCredential(serverId: string, userId: string): Promise<(McpCredential & { expires_at: string | null }) | null> {
  const db = await admin();
  const { data } = await db
    .from("mcp_credentials")
    .select("ciphertext, key_version, expires_at")
    .eq("server_id", serverId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const cred = JSON.parse(await decryptSecret(data.ciphertext, `mcp:${serverId}:${userId}`, data.key_version)) as McpCredential;
  return { ...cred, expires_at: data.expires_at };
}

export async function encryptSmall(value: string, aad: string) {
  const { version, ciphertext } = await encryptSecret(value, aad);
  return `${version}:${ciphertext}`;
}
export async function decryptSmall(value: string, aad: string) {
  const i = value.indexOf(":");
  return decryptSecret(value.slice(i + 1), aad, value.slice(0, i));
}
