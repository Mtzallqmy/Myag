// Secure Agent Runtime Adapter (server-to-server). The runtime is an external isolated
// service; this app never executes project code itself. See docs/RUNTIME_CONTRACT.md.

export function runtimeConfigured(): boolean {
  const url = process.env["AGENT_RUNTIME_BASE_URL"];
  const secret = process.env["AGENT_RUNTIME_SHARED_SECRET"];
  return !!url && url.startsWith("https://") && !!secret && secret.length >= 32;
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class RuntimeUnavailable extends Error {
  constructor() {
    super("RUNTIME_UNAVAILABLE");
  }
}

/** Calls the runtime with an HMAC-signed request: X-Runtime-Timestamp + X-Runtime-Signature. */
export async function callRuntime<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (!runtimeConfigured()) throw new RuntimeUnavailable();
  const base = process.env["AGENT_RUNTIME_BASE_URL"]!.replace(/\/+$/, "");
  const secret = process.env["AGENT_RUNTIME_SHARED_SECRET"]!;
  const ts = Math.floor(Date.now() / 1000).toString();
  const raw = body === undefined ? "" : JSON.stringify(body);
  const signature = await sign(secret, `${ts}.${method}.${path}.${raw}`);
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-runtime-timestamp": ts, "x-runtime-signature": signature },
    ...(body === undefined ? {} : { body: raw }),
    signal: AbortSignal.timeout(60_000),
    redirect: "error",
  });
  if (!res.ok) throw new Error(`RUNTIME_HTTP_${res.status}`);
  return (await res.json()) as T;
}
