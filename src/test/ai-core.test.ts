import { describe, expect, it } from "vitest";
import { joinEndpoint, normalizeBaseUrl, validateOutboundUrl } from "@/lib/ai/url-guard";
import { matchesFilter, normalizeModel, parseModelsResponse } from "@/lib/ai/models";
import { selectCandidates, type RoutableModel } from "@/lib/ai/routing";
import { decryptSecret, encryptSecret, tokenHint } from "@/lib/server/crypto.server";

describe("URL guard (SSRF)", () => {
  const blocked = [
    "http://api.openai.com/v1",
    "ftp://example.com",
    "file:///etc/passwd",
    "gopher://x.com",
    "https://localhost/v1",
    "https://foo.localhost",
    "https://127.0.0.1",
    "https://2130706433",
    "https://0x7f000001",
    "https://10.0.0.5",
    "https://172.20.1.1",
    "https://192.168.1.1",
    "https://169.254.169.254/latest/meta-data",
    "https://100.64.0.1",
    "https://[::1]",
    "https://[fd00::1]",
    "https://[fe80::1]",
    "https://[::ffff:127.0.0.1]",
    "https://metadata.google.internal",
    "https://router",
    "https://user:pass@api.example.com",
    "https://api.example.com:22",
  ];
  it.each(blocked)("blocks %s", (u) => {
    expect(validateOutboundUrl(u).ok).toBe(false);
  });
  it("allows public https", () => {
    expect(validateOutboundUrl("https://openrouter.ai/api/v1").ok).toBe(true);
    expect(validateOutboundUrl("https://integrate.api.nvidia.com/v1").ok).toBe(true);
  });
});

describe("Base URL normalization", () => {
  it("never duplicates /v1", () => {
    expect(normalizeBaseUrl("https://api.x.com/v1/v1/")).toBe("https://api.x.com/v1");
    expect(joinEndpoint(normalizeBaseUrl("https://api.x.com/v1"), "/models")).toBe("https://api.x.com/v1/models");
    expect(joinEndpoint(normalizeBaseUrl("https://api.x.com"), "/models")).toBe("https://api.x.com/v1/models");
  });
  it("strips endpoint suffixes and query", () => {
    expect(normalizeBaseUrl("https://api.x.com/v1/chat/completions?a=1")).toBe("https://api.x.com/v1");
    expect(normalizeBaseUrl("https://api.x.com/v1/models")).toBe("https://api.x.com/v1");
  });
  it("respects /api/v1 bases", () => {
    expect(joinEndpoint("https://openrouter.ai/api/v1", "/chat/completions")).toBe(
      "https://openrouter.ai/api/v1/chat/completions",
    );
  });
});

describe("Model discovery normalization", () => {
  it("OpenRouter zero pricing is FREE_VERIFIED with capabilities", () => {
    const m = normalizeModel(
      {
        id: "meta/llama:free",
        name: "Llama Free",
        context_length: 131072,
        pricing: { prompt: "0", completion: "0" },
        architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
        supported_parameters: ["tools", "reasoning"],
      },
      "OPENROUTER",
    )!;
    expect(m.price_class).toBe("FREE_VERIFIED");
    expect(m.capabilities.vision).toBe("SUPPORTED");
    expect(m.capabilities.tool_calling).toBe("SUPPORTED");
    expect(m.context_length).toBe(131072);
  });
  it("does not mark unknown pricing as free", () => {
    const m = normalizeModel({ id: "gpt-4o" }, "OPENAI_COMPATIBLE")!;
    expect(m.price_class).toBe("UNKNOWN");
    expect(m.capabilities.vision).toBe("INFERRED");
  });
  it("rejects invalid shapes", () => {
    expect(() => parseModelsResponse({ foo: 1 }, "OPENAI_COMPATIBLE")).toThrow();
    expect(parseModelsResponse({ data: [{ id: "a" }, { id: "a" }] }, "OPENAI_COMPATIBLE")).toHaveLength(1);
  });
});

const mk = (o: Partial<RoutableModel>): RoutableModel => ({
  id: o.external_model_id!,
  provider_id: "p1",
  display_name: o.external_model_id!,
  price_class: "UNKNOWN",
  context_length: 8000,
  status: "UNKNOWN",
  is_available: true,
  capabilities_json: { chat: "INFERRED" },
  metadata_json: {},
  ...o,
} as RoutableModel);

describe("Routing", () => {
  const providers = [{ id: "p1", status: "ONLINE" }];
  const models = [
    mk({ external_model_id: "small-8b", price_class: "FREE_VERIFIED" }),
    mk({ external_model_id: "gpt-5", price_class: "PAID", context_length: 400_000 }),
    mk({ external_model_id: "qwen-coder", price_class: "PAID" }),
    mk({ external_model_id: "embed-x", capabilities_json: { chat: "UNSUPPORTED" } }),
  ];
  it("prefers free", () => {
    expect(selectCandidates({ mode: "PREFER_FREE", models, providers, fallbackEnabled: true })[0]?.id).toBe("small-8b");
  });
  it("prefers strongest", () => {
    expect(selectCandidates({ mode: "PREFER_STRONGEST", models, providers, fallbackEnabled: true })[0]?.id).toBe("gpt-5");
  });
  it("prefers coding", () => {
    expect(selectCandidates({ mode: "PREFER_CODING", models, providers, fallbackEnabled: true })[0]?.id).toBe("qwen-coder");
  });
  it("fallback is bounded to 2 and disabled means 1", () => {
    expect(selectCandidates({ mode: "AUTO", models, providers, fallbackEnabled: true })).toHaveLength(2);
    expect(selectCandidates({ mode: "AUTO", models, providers, fallbackEnabled: false })).toHaveLength(1);
  });
  it("never routes to non-chat models or failed providers", () => {
    const r = selectCandidates({ mode: "AUTO", models, providers, fallbackEnabled: true });
    expect(r.find((m) => m.id === "embed-x")).toBeUndefined();
    expect(selectCandidates({ mode: "AUTO", models, providers: [{ id: "p1", status: "AUTH_FAILED" }], fallbackEnabled: true })).toHaveLength(0);
  });
  it("manual without a model returns nothing", () => {
    expect(selectCandidates({ mode: "MANUAL", models, providers, fallbackEnabled: true })).toHaveLength(0);
  });
  it("filters work", () => {
    expect(models.filter((m) => matchesFilter(m, "free")).map((m) => m.id)).toEqual(["small-8b"]);
    expect(models.filter((m) => matchesFilter(m, "long")).map((m) => m.id)).toEqual(["gpt-5"]);
  });
});

describe("Secret encryption", () => {
  const rawKey = "x".repeat(64);
  it("round-trips and binds to AAD", async () => {
    const { ciphertext, version } = await encryptSecret("sk-secret-token-1234", "prov:user", { rawKey });
    expect(ciphertext).not.toContain("sk-secret");
    expect(await decryptSecret(ciphertext, "prov:user", version, { rawKey })).toBe("sk-secret-token-1234");
    await expect(decryptSecret(ciphertext, "prov:other", version, { rawKey })).rejects.toBeTruthy();
  });
  it("hint reveals only the edges", () => {
    expect(tokenHint("sk-abcdefghijklmnop")).toBe("sk-…mnop");
  });
});
