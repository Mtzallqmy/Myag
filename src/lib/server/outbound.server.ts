// SSRF-safe outbound fetch: validates URL, resolves DNS over HTTPS to reject private
// targets, and follows redirects manually with re-validation on every hop.
import { isPrivateAddress, validateOutboundUrl } from "@/lib/ai/url-guard";

export class OutboundError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const MAX_REDIRECTS = 3;

async function resolveAll(host: string): Promise<string[]> {
  const ips: string[] = [];
  for (const type of ["A", "AAAA"]) {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
      { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) throw new OutboundError("DNS_FAILED");
    const json = (await res.json()) as { Answer?: { type: number; data: string }[] };
    for (const a of json.Answer ?? []) if (a.type === 1 || a.type === 28) ips.push(a.data);
  }
  return ips;
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const v = validateOutboundUrl(raw);
  if (!v.ok) throw new OutboundError(v.error);
  const host = v.url.hostname.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) return v.url; // literal IP already checked
  let ips: string[];
  try {
    ips = await resolveAll(host);
  } catch (e) {
    throw e instanceof OutboundError ? e : new OutboundError("DNS_FAILED");
  }
  if (ips.length === 0) throw new OutboundError("DNS_NOT_FOUND");
  if (ips.some(isPrivateAddress)) throw new OutboundError("PRIVATE_ADDRESS");
  return v.url;
}

export async function safeFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 20_000, ...rest } = init;
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = rest.signal ? AbortSignal.any([rest.signal, timeout]) : timeout;
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);
    let res: Response;
    try {
      res = await fetch(current, { ...rest, signal, redirect: "manual" });
    } catch (e) {
      if ((e as Error)?.name === "AbortError" || (e as Error)?.name === "TimeoutError") {
        throw new OutboundError(rest.signal?.aborted ? "CANCELLED" : "TIMEOUT");
      }
      throw new OutboundError("NETWORK_ERROR");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = new URL(res.headers.get("location")!, current).toString();
      // Never forward credentials across origins.
      if (new URL(next).origin !== new URL(current).origin) throw new OutboundError("REDIRECT_BLOCKED");
      current = next;
      continue;
    }
    return res;
  }
  throw new OutboundError("TOO_MANY_REDIRECTS");
}
