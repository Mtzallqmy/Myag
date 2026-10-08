// Shared, client-safe domain types for providers, models and routing.

export const PROVIDER_TYPES = [
  "OPENAI_COMPATIBLE",
  "OPENROUTER",
  "NVIDIA_NIM",
  "CUSTOM_OPENAI_COMPATIBLE",
] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const PROVIDER_STATUSES = [
  "UNKNOWN",
  "CHECKING",
  "ONLINE",
  "DEGRADED",
  "AUTH_FAILED",
  "RATE_LIMITED",
  "OFFLINE",
  "INVALID_RESPONSE",
  "DISABLED",
] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const CAPABILITIES = [
  "chat",
  "streaming",
  "tool_calling",
  "vision",
  "reasoning",
  "structured_output",
  "embeddings",
  "audio_input",
  "audio_output",
  "image_generation",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export type CapabilityState = "SUPPORTED" | "UNSUPPORTED" | "UNKNOWN" | "INFERRED";
export type Capabilities = Partial<Record<Capability, CapabilityState>>;

export const PRICE_CLASSES = ["FREE_VERIFIED", "FREE_REPORTED", "PAID", "UNKNOWN"] as const;
export type PriceClass = (typeof PRICE_CLASSES)[number];

export const ROUTING_MODES = [
  "AUTO",
  "PREFER_FREE",
  "PREFER_CHEAP",
  "PREFER_FAST",
  "PREFER_STRONGEST",
  "PREFER_CODING",
  "PREFER_LONG_CONTEXT",
  "MANUAL",
] as const;
export type RoutingMode = (typeof ROUTING_MODES)[number];

export type ModelStatus = "UNKNOWN" | "ONLINE" | "FAILED";

export interface NormalizedModel {
  external_model_id: string;
  display_name: string;
  price_class: PriceClass;
  context_length: number | null;
  capabilities: Capabilities;
  metadata: Record<string, unknown>;
}

/** Max number of models tried per chat request (primary + fallbacks). */
export const MAX_MODEL_ATTEMPTS = 2;
