import type { AiProvider, EssayAnalysisRequest, EssayAnalysisResponse, ModelTier } from "./types";
import { resolveModel, resolveTier } from "./modelTiering";
import { requestHasImages } from "./prompts";
import { analyzeWithGemini } from "./gemini";
import { analyzeWithClaude } from "./claude";
import { analyzeWithDeepSeek } from "./deepseek";

export interface AnalyzeResult {
  result: EssayAnalysisResponse;
  model: string; // concrete model id used
  tier: string; // "flash" | "pro" | "pro_fallback"
}

async function callProvider(
  request: EssayAnalysisRequest,
  provider: AiProvider,
  modelId: string,
  timeoutMs: number,
): Promise<EssayAnalysisResponse> {
  switch (provider) {
    case "claude":
      return analyzeWithClaude(request, modelId, timeoutMs);
    case "deepseek":
      return analyzeWithDeepSeek(request, modelId, timeoutMs);
    default:
      return analyzeWithGemini(request, modelId, timeoutMs);
  }
}

/**
 * Provider-agnostic essay analysis with hybrid tiering.
 * Resolve the model from the tier (which the caller derives from the user's plan).
 * Image answers route to a vision-capable provider (Gemini) even when the base
 * provider is text-only (DeepSeek). On a premium failure, fall back to Flash so the
 * user still gets a result (the fallback keeps vision routing too).
 */
export async function analyzeEssay(request: EssayAnalysisRequest, tier: ModelTier): Promise<AnalyzeResult> {
  const hasImages = requestHasImages(request);
  const primary = resolveModel(tier, { hasImages });
  try {
    const result = await callProvider(request, primary.provider, primary.modelId, primary.timeoutMs);
    return { result, model: primary.modelId, tier: primary.tier };
  } catch (error) {
    if (tier !== "pro") throw error; // flash has no fallback
    console.warn(`Premium model failed (${primary.modelId}); falling back to Flash:`, error);
    const fallback = resolveModel("flash", { hasImages });
    const result = await callProvider(request, fallback.provider, fallback.modelId, fallback.timeoutMs);
    return { result, model: fallback.modelId, tier: "pro_fallback" };
  }
}

export { resolveTier, resolveModel };
export type { EssayAnalysisRequest, EssayAnalysisResponse, ModelTier };
