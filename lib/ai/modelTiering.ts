import type { AiProvider, ModelTier } from "./types";

/** Single source of truth: which model tier each plan gets. */
export const PLAN_TIER: Record<string, ModelTier> = {
  trial: "flash",
  individual: "flash",
  individual_yearly: "flash",
  educator: "pro",
  educator_yearly: "pro",
  business: "pro",
};

export function resolveTier(planId: string | null | undefined): ModelTier {
  if (!planId) return "flash";
  return PLAN_TIER[planId] ?? "flash";
}

export interface ResolvedModel {
  provider: AiProvider;
  modelId: string;
  tier: ModelTier;
  timeoutMs: number;
}

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || Number(process.env.GEMINI_TIMEOUT_MS) || 85_000;

function normalizeProvider(value: string | undefined): AiProvider | null {
  switch ((value || "").toLowerCase()) {
    case "deepseek":
      return "deepseek";
    case "claude":
    case "anthropic":
      return "claude";
    case "gemini":
    case "google":
      return "gemini";
    default:
      return null;
  }
}

/** Base provider for the default (flash) tier. Set AI_PROVIDER=deepseek to switch off Gemini. */
function baseProvider(): AiProvider {
  return normalizeProvider(process.env.AI_PROVIDER) ?? "gemini";
}

/** Premium (pro) tier provider; defaults to PREMIUM_PROVIDER, else the base provider. */
function premiumProvider(): AiProvider {
  return normalizeProvider(process.env.PREMIUM_PROVIDER) ?? baseProvider();
}

/**
 * Vision-capable provider used for image answers when the base provider is text-only.
 * Hybrid mode: text grading runs on the (cheaper) base provider, image answers fall
 * over to this one. Defaults to Gemini; override with AI_VISION_PROVIDER.
 */
function visionProvider(): AiProvider {
  return normalizeProvider(process.env.AI_VISION_PROVIDER) ?? "gemini";
}

/** Which providers can read inline image data. DeepSeek is text-only. */
export function providerSupportsVision(provider: AiProvider): boolean {
  return provider === "gemini" || provider === "claude";
}

function modelFor(provider: AiProvider, tier: ModelTier): string {
  switch (provider) {
    case "deepseek":
      // deepseek-chat (V3) supports JSON mode; deepseek-reasoner (R1) does not, so default both to chat.
      return tier === "pro"
        ? process.env.DEEPSEEK_PRO_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-chat"
        : process.env.DEEPSEEK_MODEL || "deepseek-chat";
    case "claude":
      return process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest";
    default:
      return tier === "pro"
        ? process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro"
        : process.env.GEMINI_MODEL || "gemini-2.5-flash";
  }
}

/**
 * Map a tier to a concrete provider + model id (env-configurable).
 * Pass `{ hasImages: true }` for image answers: if the tier's provider is text-only
 * (e.g. DeepSeek), this transparently routes to the vision provider (hybrid mode).
 */
export function resolveModel(tier: ModelTier, opts?: { hasImages?: boolean }): ResolvedModel {
  const provider = tier === "pro" ? premiumProvider() : baseProvider();
  if (opts?.hasImages && !providerSupportsVision(provider)) {
    const vp = visionProvider();
    return { provider: vp, modelId: modelFor(vp, tier), tier, timeoutMs: TIMEOUT_MS };
  }
  return { provider, modelId: modelFor(provider, tier), tier, timeoutMs: TIMEOUT_MS };
}
