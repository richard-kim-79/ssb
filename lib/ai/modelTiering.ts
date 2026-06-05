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

/** Base provider for the default (flash) tier. Defaults to Gemini. */
function baseProvider(): AiProvider {
  return normalizeProvider(process.env.AI_PROVIDER) ?? "gemini";
}

/** Premium (pro) tier provider; defaults to PREMIUM_PROVIDER, else the base provider. */
function premiumProvider(): AiProvider {
  return normalizeProvider(process.env.PREMIUM_PROVIDER) ?? baseProvider();
}

function modelFor(provider: AiProvider, tier: ModelTier): string {
  switch (provider) {
    case "claude":
      return process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest";
    default:
      return tier === "pro"
        ? process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro"
        : process.env.GEMINI_MODEL || "gemini-2.5-flash";
  }
}

/** Map a tier to a concrete provider + model id (env-configurable). */
export function resolveModel(tier: ModelTier): ResolvedModel {
  const provider = tier === "pro" ? premiumProvider() : baseProvider();
  return { provider, modelId: modelFor(provider, tier), tier, timeoutMs: TIMEOUT_MS };
}
