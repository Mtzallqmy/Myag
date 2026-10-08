// Authenticated encryption (AES-256-GCM) for provider tokens, with key versioning.
// Master keys live only in server secrets: PROVIDER_ENCRYPTION_KEY_<VERSION>.

export const CURRENT_KEY_VERSION = "v1";

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(version: string, rawOverride?: string): Promise<CryptoKey> {
  const raw = rawOverride ?? process.env[`PROVIDER_ENCRYPTION_KEY_${version.toUpperCase()}`];
  if (!raw || raw.length < 32) throw new Error("ENCRYPTION_KEY_MISSING");
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Encrypts plaintext bound to `aad` (e.g. providerId:userId). Returns "iv.ciphertext" base64. */
export async function encryptSecret(
  plaintext: string,
  aad: string,
  opts: { version?: string; rawKey?: string } = {},
): Promise<{ version: string; ciphertext: string }> {
  const version = opts.version ?? CURRENT_KEY_VERSION;
  const key = await getKey(version, opts.rawKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(aad) },
    key,
    enc.encode(plaintext),
  );
  return { version, ciphertext: `${b64(iv)}.${b64(new Uint8Array(ct))}` };
}

export async function decryptSecret(
  payload: string,
  aad: string,
  version: string,
  opts: { rawKey?: string } = {},
): Promise<string> {
  const [ivB64, ctB64] = payload.split(".");
  if (!ivB64 || !ctB64) throw new Error("CIPHERTEXT_MALFORMED");
  const key = await getKey(version, opts.rawKey);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(ivB64), additionalData: enc.encode(aad) },
    key,
    unb64(ctB64),
  );
  return dec.decode(pt);
}

/** Only the last 4 characters are ever shown back to the user. */
export function tokenHint(token: string): string {
  const t = token.trim();
  if (t.length <= 8) return "••••";
  return `${t.slice(0, 3)}…${t.slice(-4)}`;
}
