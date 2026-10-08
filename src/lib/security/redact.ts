// Output sanitizer: redacts credentials from external content before it reaches
// the model or the browser. Pure and client-safe.

const PATTERNS: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
  [/\b(authorization|proxy-authorization)\s*[:=]\s*("?)[^\n"]+\2/gi, "$1: [REDACTED]"],
  [/\bBearer\s+[A-Za-z0-9\-._~+/]{8,}=*/g, "Bearer [REDACTED]"],
  [/\b(sk|rk|pk)-(?:proj-|live-|test-)?[A-Za-z0-9_\-]{16,}/g, "[REDACTED_KEY]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[REDACTED_GITHUB_TOKEN]"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "[REDACTED_GITHUB_TOKEN]"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}\b/g, "[REDACTED_SLACK_TOKEN]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED_AWS_KEY]"],
  [/\bAIza[0-9A-Za-z\-_]{35}\b/g, "[REDACTED_GOOGLE_KEY]"],
  [/\bnvapi-[A-Za-z0-9_\-]{20,}\b/g, "[REDACTED_KEY]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[REDACTED_JWT]"],
  [/("?(?:access_token|refresh_token|id_token|client_secret|api_key|apikey|password|passwd|secret|token)"?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,}&]+)/gi, "$1\"[REDACTED]\""],
  [/\b(set-cookie|cookie)\s*:\s*[^\n]+/gi, "$1: [REDACTED]"],
];

export function redactSecrets(input: string): string {
  let out = input;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  return out;
}

/** Deep-redacts any JSON-like value; keys that look sensitive are blanked entirely. */
export function redactValue(v: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED]";
  if (typeof v === "string") return redactSecrets(v);
  if (Array.isArray(v)) return v.slice(0, 500).map((x) => redactValue(x, depth + 1));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      out[k] = /^(authorization|cookie|set-cookie|password|passwd|secret|client_secret|access_token|refresh_token|id_token|api[_-]?key|private[_-]?key|token)$/i.test(k)
        ? "[REDACTED]"
        : redactValue(val, depth + 1);
    }
    return out;
  }
  return v;
}

/** Detects likely secrets in content about to be pushed (pre-push secret scan). */
export function findSecrets(text: string): string[] {
  const hits: string[] = [];
  for (const [re, label] of PATTERNS.slice(0, 11)) {
    re.lastIndex = 0;
    if (re.test(text)) hits.push(label);
    re.lastIndex = 0;
  }
  return hits;
}
