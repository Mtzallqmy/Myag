// Client-safe model normalization, classification and filtering.
import type { Capabilities, CapabilityState, NormalizedModel, PriceClass, ProviderType } from "./types";

type Raw = Record<string, unknown>;

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

function priceClass(raw: Raw, id: string, providerType: ProviderType): PriceClass {
  const pricing = raw["pricing"] as Raw | undefined;
  if (pricing && typeof pricing === "object") {
    const prompt = num(pricing["prompt"]);
    const completion = num(pricing["completion"]);
    if (prompt !== null && completion !== null) {
      if (prompt === 0 && completion === 0) {
        // OpenRouter publishes authoritative pricing; other providers only report it.
        return providerType === "OPENROUTER" ? "FREE_VERIFIED" : "FREE_REPORTED";
      }
      return "PAID";
    }
  }
  if (/[:/-]free$/i.test(id)) return "FREE_REPORTED";
  return "UNKNOWN";
}

function inferFromName(id: string): Capabilities {
  const n = id.toLowerCase();
  const caps: Capabilities = {};
  if (/embed/.test(n)) {
    caps.embeddings = "INFERRED";
    caps.chat = "UNSUPPORTED";
    return caps;
  }
  if (/whisper|tts|speech/.test(n)) {
    caps.chat = "UNSUPPORTED";
    if (/whisper/.test(n)) caps.audio_input = "INFERRED";
    if (/tts|speech/.test(n)) caps.audio_output = "INFERRED";
    return caps;
  }
  if (/dall-e|stable-diffusion|sdxl|flux|imagen|image-gen/.test(n)) {
    caps.image_generation = "INFERRED";
    caps.chat = "UNSUPPORTED";
    return caps;
  }
  caps.chat = "INFERRED";
  if (/vision|-vl\b|vl-|llava|pixtral|gpt-4o|gemini|claude-3|claude-(sonnet|opus|haiku)/.test(n))
    caps.vision = "INFERRED";
  if (/\br1\b|-r1|reason|think|o1|o3|o4|qwq/.test(n)) caps.reasoning = "INFERRED";
  if (/gpt-4|gpt-5|claude|gemini|mistral-large|llama-3\.[13]|qwen-?2\.5|qwen3|command-r/.test(n))
    caps.tool_calling = "INFERRED";
  return caps;
}

/** Normalizes one entry from an OpenAI-compatible GET /models response. */
export function normalizeModel(raw: Raw, providerType: ProviderType): NormalizedModel | null {
  const id = typeof raw["id"] === "string" ? raw["id"] : null;
  if (!id) return null;
  const caps: Capabilities = inferFromName(id);
  const set = (k: keyof Capabilities, v: CapabilityState) => {
    caps[k] = v;
  };

  const arch = raw["architecture"] as Raw | undefined;
  const inputMods = Array.isArray(arch?.["input_modalities"]) ? (arch!["input_modalities"] as string[]) : null;
  const outputMods = Array.isArray(arch?.["output_modalities"]) ? (arch!["output_modalities"] as string[]) : null;
  if (inputMods) {
    set("vision", inputMods.includes("image") ? "SUPPORTED" : "UNSUPPORTED");
    set("audio_input", inputMods.includes("audio") ? "SUPPORTED" : "UNSUPPORTED");
  }
  if (outputMods) {
    set("chat", outputMods.includes("text") ? "SUPPORTED" : "UNSUPPORTED");
    set("image_generation", outputMods.includes("image") ? "SUPPORTED" : "UNSUPPORTED");
    set("audio_output", outputMods.includes("audio") ? "SUPPORTED" : "UNSUPPORTED");
  }
  const params = Array.isArray(raw["supported_parameters"]) ? (raw["supported_parameters"] as string[]) : null;
  if (params) {
    set("tool_calling", params.includes("tools") ? "SUPPORTED" : "UNSUPPORTED");
    set("reasoning", params.includes("reasoning") || params.includes("include_reasoning") ? "SUPPORTED" : "UNSUPPORTED");
    set(
      "structured_output",
      params.includes("structured_outputs") || params.includes("response_format") ? "SUPPORTED" : "UNSUPPORTED",
    );
  }

  const top = raw["top_provider"] as Raw | undefined;
  const context =
    num(raw["context_length"]) ?? num(top?.["context_length"]) ?? num(raw["max_model_len"]) ?? num(raw["context_window"]);

  const name = typeof raw["name"] === "string" && raw["name"].trim() ? raw["name"].trim() : id;
  const metadata: Record<string, unknown> = { owned_by: raw["owned_by"] ?? null };
  const pricing = raw["pricing"] as Raw | undefined;
  if (pricing) metadata["pricing"] = { prompt: pricing["prompt"] ?? null, completion: pricing["completion"] ?? null };
  if (typeof raw["description"] === "string") metadata["description"] = raw["description"].slice(0, 500);

  return {
    external_model_id: id,
    display_name: name.slice(0, 200),
    price_class: priceClass(raw, id, providerType),
    context_length: context ? Math.round(context) : null,
    capabilities: caps,
    metadata,
  };
}

export function parseModelsResponse(json: unknown, providerType: ProviderType): NormalizedModel[] {
  const list = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as Raw)["data"])
      ? ((json as Raw)["data"] as unknown[])
      : json && typeof json === "object" && Array.isArray((json as Raw)["models"])
        ? ((json as Raw)["models"] as unknown[])
        : null;
  if (!list) throw new Error("INVALID_RESPONSE");
  const seen = new Set<string>();
  const out: NormalizedModel[] = [];
  for (const item of list.slice(0, 2000)) {
    if (!item || typeof item !== "object") continue;
    const m = normalizeModel(item as Raw, providerType);
    if (m && !seen.has(m.external_model_id)) {
      seen.add(m.external_model_id);
      out.push(m);
    }
  }
  return out;
}

// ---------- classification helpers used by filters + routing ----------

export interface ModelLike {
  external_model_id: string;
  display_name: string;
  price_class: string;
  context_length: number | null;
  status: string;
  is_available: boolean;
  capabilities_json: unknown;
  metadata_json: unknown;
}

export const capsOf = (m: ModelLike): Capabilities =>
  (m.capabilities_json && typeof m.capabilities_json === "object" ? m.capabilities_json : {}) as Capabilities;

export const hasCap = (m: ModelLike, c: keyof Capabilities, allowInferred = true) => {
  const s = capsOf(m)[c];
  return s === "SUPPORTED" || (allowInferred && s === "INFERRED");
};

export const isFree = (m: ModelLike) => m.price_class === "FREE_VERIFIED" || m.price_class === "FREE_REPORTED";
export const isCoding = (m: ModelLike) =>
  /code|coder|codestral|devstral|deepseek|starcoder|qwen.*coder|kimi|claude|gpt-5|gpt-4\.1/i.test(m.external_model_id);
export const latencyOf = (m: ModelLike): number | null => {
  const meta = (m.metadata_json ?? {}) as Record<string, unknown>;
  return typeof meta["latency_ms"] === "number" ? meta["latency_ms"] : null;
};
export const isFast = (m: ModelLike) => {
  const l = latencyOf(m);
  if (l !== null) return l < 2500;
  return /flash|mini|nano|lite|small|haiku|instant|turbo|\b[1-9]b\b|8b|7b/i.test(m.external_model_id);
};
export const isLongContext = (m: ModelLike) => (m.context_length ?? 0) >= 128_000;
export const isChatCapable = (m: ModelLike) => capsOf(m).chat !== "UNSUPPORTED";

export const MODEL_FILTERS = [
  "all",
  "free",
  "working",
  "tools",
  "vision",
  "reasoning",
  "coding",
  "fast",
  "long",
] as const;
export type ModelFilter = (typeof MODEL_FILTERS)[number];

export function matchesFilter(m: ModelLike, f: ModelFilter): boolean {
  switch (f) {
    case "free":
      return isFree(m);
    case "working":
      return m.status === "ONLINE" && m.is_available;
    case "tools":
      return hasCap(m, "tool_calling");
    case "vision":
      return hasCap(m, "vision");
    case "reasoning":
      return hasCap(m, "reasoning");
    case "coding":
      return isCoding(m);
    case "fast":
      return isFast(m);
    case "long":
      return isLongContext(m);
    default:
      return true;
  }
}
