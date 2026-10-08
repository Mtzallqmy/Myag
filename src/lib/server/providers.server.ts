// Provider adapters (OpenAI-compatible family). Server-only.
import { joinEndpoint } from "@/lib/ai/url-guard";
import { parseModelsResponse } from "@/lib/ai/models";
import type { NormalizedModel, ProviderStatus, ProviderType } from "@/lib/ai/types";
import { OutboundError, safeFetch } from "./outbound.server";

export interface ProviderConn {
  baseUrl: string;
  providerType: ProviderType;
  token: string;
}

interface Adapter {
  headers(token: string): Record<string, string>;
  modelsUrl(base: string): string;
  chatUrl(base: string): string;
}

const openAiAdapter: Adapter = {
  headers: (token) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
  modelsUrl: (b) => joinEndpoint(b, "/models"),
  chatUrl: (b) => joinEndpoint(b, "/chat/completions"),
};

const adapters: Record<ProviderType, Adapter> = {
  OPENAI_COMPATIBLE: openAiAdapter,
  CUSTOM_OPENAI_COMPATIBLE: openAiAdapter,
  NVIDIA_NIM: openAiAdapter,
  OPENROUTER: {
    ...openAiAdapter,
    headers: (token) => ({
      ...openAiAdapter.headers(token),
      "HTTP-Referer": "https://lovable.app",
      "X-Title": "Wakeel Code Agent",
    }),
  },
};

export function adapterFor(type: ProviderType): Adapter {
  return adapters[type] ?? openAiAdapter;
}

export function statusFromHttp(status: number): ProviderStatus {
  if (status === 401 || status === 403) return "AUTH_FAILED";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "DEGRADED";
  if (status >= 400) return "INVALID_RESPONSE";
  return "ONLINE";
}

export function safeErrorCode(e: unknown): string {
  if (e instanceof OutboundError) return e.code;
  return "UNEXPECTED";
}

export async function listModels(conn: ProviderConn): Promise<
  | { ok: true; models: NormalizedModel[]; latencyMs: number }
  | { ok: false; status: ProviderStatus; code: string; latencyMs: number }
> {
  const a = adapterFor(conn.providerType);
  const started = Date.now();
  try {
    const res = await safeFetch(a.modelsUrl(conn.baseUrl), {
      method: "GET",
      headers: a.headers(conn.token),
      timeoutMs: 15_000,
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return { ok: false, status: statusFromHttp(res.status), code: `HTTP_${res.status}`, latencyMs };
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, status: "INVALID_RESPONSE", code: "NOT_JSON", latencyMs };
    }
    try {
      return { ok: true, models: parseModelsResponse(json, conn.providerType), latencyMs };
    } catch {
      return { ok: false, status: "INVALID_RESPONSE", code: "BAD_SHAPE", latencyMs };
    }
  } catch (e) {
    const code = safeErrorCode(e);
    const status: ProviderStatus =
      code === "TIMEOUT" || code === "NETWORK_ERROR" || code === "DNS_NOT_FOUND" ? "OFFLINE" : "INVALID_RESPONSE";
    return { ok: false, status, code, latencyMs: Date.now() - started };
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Starts a chat completion. Returns the raw upstream response (stream or JSON). */
export async function startChat(
  conn: ProviderConn,
  model: string,
  messages: ChatMessage[],
  opts: { stream: boolean; signal?: AbortSignal; maxTokens?: number },
): Promise<Response> {
  const a = adapterFor(conn.providerType);
  return safeFetch(a.chatUrl(conn.baseUrl), {
    method: "POST",
    headers: a.headers(conn.token),
    body: JSON.stringify({
      model,
      messages,
      stream: opts.stream,
      ...(opts.stream ? { stream_options: { include_usage: true } } : {}),
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    }),
    ...(opts.signal ? { signal: opts.signal } : {}),
    timeoutMs: opts.stream ? 120_000 : 30_000,
  });
}
