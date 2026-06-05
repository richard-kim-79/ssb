import type { ModelTier } from "./types";

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
  provider: "gemini" | "claude";
  modelId: string;
  tier: ModelTier;
  timeoutMs: number;
}

const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 85_000;

/** Map a tier to a concrete provider + model id (env-configurable). */
export function resolveModel(tier: ModelTier): ResolvedModel {
  if (tier === "pro") {
    const provider = process.env.PREMIUM_PROVIDER === "claude" ? "claude" : "gemini";
    if (provider === "claude") {
      return {
        provider: "claude",
        modelId: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest",
        tier,
        timeoutMs: TIMEOUT_MS,
      };
    }
    return {
      provider: "gemini",
      modelId: process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro",
      tier,
      timeoutMs: TIMEOUT_MS,
    };
  }
  return {
    provider: "gemini",
    modelId: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    tier,
    timeoutMs: TIMEOUT_MS,
  };
}
