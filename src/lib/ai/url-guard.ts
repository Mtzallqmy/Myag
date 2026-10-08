// SSRF protection for user-supplied provider Base URLs.
// Pure and client-safe so it can be unit-tested; the server re-validates every hop.

export type UrlGuardError =
  | "INVALID_URL"
  | "PROTOCOL_NOT_ALLOWED"
  | "CREDENTIALS_NOT_ALLOWED"
  | "HOST_NOT_ALLOWED"
  | "PRIVATE_ADDRESS"
  | "PORT_NOT_ALLOWED";

export type UrlGuardResult = { ok: true; url: URL } | { ok: false; error: UrlGuardError };

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "instance-data.ec2.internal",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".corp",
  ".svc",
  ".cluster.local",
];

function parseIPv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => Number.isNaN(n) || n > 255)) return null;
  return nums;
}

export function isPrivateIPv4(host: string): boolean {
  const ip = parseIPv4(host);
  if (!ip) return false;
  const [a = 0, b = 0] = ip;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local + cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast + reserved
  );
}

export function isPrivateIPv6(raw: string): boolean {
  const host = raw.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host.includes(":")) return false;
  if (host === "::" || host === "::1") return true;
  // IPv4-mapped / translated (::ffff:a.b.c.d or ::ffff:7f00:1)
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1] ?? "");
  if (/^::ffff:/.test(host)) return true; // hex-encoded mapped form: block conservatively
  if (/^64:ff9b:/.test(host)) return true;
  const first = parseInt(host.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // multicast
  return false;
}

export function isPrivateAddress(host: string): boolean {
  return isPrivateIPv4(host) || isPrivateIPv6(host);
}

/** Validates a URL for outbound calls. HTTPS only, public hosts only. */
export function validateOutboundUrl(input: string): UrlGuardResult {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, error: "INVALID_URL" };
  }
  if (url.protocol !== "https:") return { ok: false, error: "PROTOCOL_NOT_ALLOWED" };
  if (url.username || url.password) return { ok: false, error: "CREDENTIALS_NOT_ALLOWED" };
  if (url.port && !["443", "8443"].includes(url.port)) {
    return { ok: false, error: "PORT_NOT_ALLOWED" };
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || BLOCKED_HOSTNAMES.has(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, error: "HOST_NOT_ALLOWED" };
  }
  if (isPrivateAddress(host)) return { ok: false, error: "PRIVATE_ADDRESS" };
  // Single-label hostnames (e.g. "router") resolve only inside private networks.
  if (!host.includes(".") && !host.includes(":")) return { ok: false, error: "HOST_NOT_ALLOWED" };
  return { ok: true, url };
}

/**
 * Normalizes a provider Base URL so endpoint paths can be appended safely.
 * Strips trailing slashes, query/hash, and known endpoint suffixes; never duplicates /v1.
 */
export function normalizeBaseUrl(input: string): string {
  const url = new URL(input.trim());
  url.hash = "";
  url.search = "";
  let path = url.pathname.replace(/\/+$/, "");
  path = path.replace(/\/(chat\/completions|completions|models|embeddings)$/i, "");
  path = path.replace(/(\/v1)+$/i, "/v1");
  url.pathname = path || "";
  return url.toString().replace(/\/+$/, "");
}

/** Joins a normalized base with an endpoint path like "/models". Adds /v1 only when missing. */
export function joinEndpoint(base: string, endpoint: string, addV1 = true): string {
  const b = base.replace(/\/+$/, "");
  const e = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const hasVersion = /\/v\d+(beta\d*)?$/i.test(b) || /\/api\/v\d+/i.test(b) || /\/openai$/i.test(b);
  return addV1 && !hasVersion ? `${b}/v1${e}` : `${b}${e}`;
}
