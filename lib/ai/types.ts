import type { CategoryScore } from "@/lib/db/schema";

export interface EssayAnalysisRequest {
  promptText: string;
  criteriaText: string;
  essayText: string;
  studentInfo?: {
    name?: string;
    studentId?: string;
  };
}

export interface EssayAnalysisResponse {
  overallScore: number;
  maxScore: number;
  categories: CategoryScore[];
  strengths: string[];
  improvementAreas: string[];
  detailedFeedback: string;
  suggestions: string[];
}

/** Multimodal content part (text or inline image). */
export type ContentPart = { text: string } | { inlineData: { data: string; mimeType: string } };

export type ModelTier = "flash" | "pro";

export type AiProvider = "gemini" | "claude" | "deepseek";
