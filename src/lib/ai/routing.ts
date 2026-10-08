// Pure model routing. Server calls this to pick the candidate list for a chat request.
import {
  hasCap,
  isChatCapable,
  isCoding,
  isFree,
  isLongContext,
  latencyOf,
  type ModelLike,
} from "./models";
import { MAX_MODEL_ATTEMPTS, type RoutingMode } from "./types";

export interface RoutableModel extends ModelLike {
  id: string;
  provider_id: string;
}
export interface RoutableProvider {
  id: string;
  status: string;
}

const UNUSABLE_PROVIDER = new Set(["AUTH_FAILED", "DISABLED", "OFFLINE", "INVALID_RESPONSE"]);

const priceRank: Record<string, number> = { FREE_VERIFIED: 0, FREE_REPORTED: 1, UNKNOWN: 2, PAID: 3 };

function promptPrice(m: ModelLike): number {
  const meta = (m.metadata_json ?? {}) as { pricing?: { prompt?: unknown } };
  const p = Number(meta.pricing?.prompt);
  return Number.isFinite(p) ? p : Number.POSITIVE_INFINITY;
}

function strength(m: ModelLike): number {
  const id = m.external_model_id.toLowerCase();
  let s = 0;
  if (/opus|gpt-5|o3|gemini-.*pro|sonnet|405b|deepseek-r1|qwen3-235b|grok-4|large/.test(id)) s += 50;
  if (/70b|72b|120b|mixtral|gpt-4/.test(id)) s += 25;
  if (/mini|nano|lite|small|flash|haiku|\b[1-9]b\b|8b|7b/.test(id)) s -= 20;
  if (hasCap(m, "reasoning")) s += 10;
  if (hasCap(m, "tool_calling")) s += 5;
  s += Math.min(20, Math.round((m.context_length ?? 0) / 50_000));
  return s;
}

// Tested-OK models first in every mode.
const healthRank = (m: ModelLike) => (m.status === "ONLINE" ? 0 : m.status === "UNKNOWN" ? 1 : 2);

export interface RouteInput {
  mode: RoutingMode;
  models: RoutableModel[];
  providers: RoutableProvider[];
  preferredModelId?: string | null;
  fallbackEnabled: boolean;
}

/** Returns an ordered, bounded list of candidate models. */
export function selectCandidates(input: RouteInput): RoutableModel[] {
  const providerOk = new Map(input.providers.map((p) => [p.id, !UNUSABLE_PROVIDER.has(p.status)]));
  const usable = input.models.filter(
    (m) => m.is_available && m.status !== "FAILED" && isChatCapable(m) && providerOk.get(m.provider_id),
  );
  const limit = input.fallbackEnabled ? MAX_MODEL_ATTEMPTS : 1;

  const preferred = input.preferredModelId
    ? input.models.find((m) => m.id === input.preferredModelId && m.is_available)
    : undefined;

  if (input.mode === "MANUAL") {
    if (!preferred) return [];
    // Manual: the chosen model first; fallback only when the user allows it.
    const rest = input.fallbackEnabled ? sortBy(usable.filter((m) => m.id !== preferred.id), "AUTO") : [];
    return [preferred, ...rest].slice(0, limit);
  }

  let pool = usable;
  if (input.mode === "PREFER_FREE") {
    const free = usable.filter(isFree);
    pool = free.length ? free : usable;
  }
  const sorted = sortBy(pool, input.mode);
  if (preferred && input.mode === "AUTO") {
    return [preferred, ...sorted.filter((m) => m.id !== preferred.id)].slice(0, limit);
  }
  return sorted.slice(0, limit);
}

function sortBy(models: RoutableModel[], mode: RoutingMode): RoutableModel[] {
  const score = (m: RoutableModel): number[] => {
    const h = healthRank(m);
    switch (mode) {
      case "PREFER_FREE":
        return [h, priceRank[m.price_class] ?? 2, -strength(m)];
      case "PREFER_CHEAP":
        return [h, priceRank[m.price_class] ?? 2, promptPrice(m)];
      case "PREFER_FAST":
        return [h, latencyOf(m) ?? 99_999, -strength(m)];
      case "PREFER_STRONGEST":
        return [h, -strength(m)];
      case "PREFER_CODING":
        return [h, /code|coder|codestral|devstral/i.test(m.external_model_id) ? 0 : isCoding(m) ? 1 : 2, -strength(m)];
      case "PREFER_LONG_CONTEXT":
        return [h, isLongContext(m) ? 0 : 1, -(m.context_length ?? 0)];
      default:
        return [h, -strength(m), priceRank[m.price_class] ?? 2];
    }
  };
  return [...models].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return (sa[i] ?? 0) - (sb[i] ?? 0);
    return a.external_model_id.localeCompare(b.external_model_id);
  });
}
