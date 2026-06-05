/**
 * AI inline 첨삭 (annotation) generation — the "red pen" half of the patch feature.
 *
 * Distinct from analyzeEssay (which produces an overall score + feedback): here the
 * model returns a list of span-level notes. Crucially, the model returns the *exact
 * quoted substring* (not char offsets — LLMs are unreliable at counting), plus a
 * short preceding-context hint to disambiguate duplicates. The server then anchors
 * each quote to real offsets (lib/patch/anchoring).
 *
 * Annotation runs on Gemini (structured output) regardless of tier; the tier only
 * picks the concrete Gemini model (flash vs pro).
 */
import type { ModelTier } from "./types";
import { isRetryableError, sleep, withTimeout } from "./retry";

const MAX_RETRIES = Number(process.env.AI_MAX_RETRIES) || 3;
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || Number(process.env.GEMINI_TIMEOUT_MS) || 85_000;

export interface AiAnnotation {
  type: "correction" | "highlight" | "comment";
  quotedText: string;
  before?: string;
  suggestedText?: string;
  comment: string;
  severity?: "minor" | "major" | "suggestion";
}

export interface AnnotateRequest {
  promptText: string;
  criteriaText: string;
  essayText: string;
}

export interface AnnotateResult {
  annotations: AiAnnotation[];
  model: string;
  tier: string;
}

function systemPrompt(): string {
  return `당신은 한국의 논술 첨삭 전문 교사입니다. 학생 답안의 특정 구간을 짚어 "빨간펜" 첨삭을 생성합니다.

규칙:
- 답안 원문에서 그대로 복사한 구간(quotedText)을 지목하세요. 절대 새로 지어내지 마세요.
- quotedText는 답안에 실제로 존재하는 정확한 문자열이어야 합니다(띄어쓰기·문장부호 포함).
- 같은 표현이 여러 번 나올 수 있으니, 해당 구간 바로 앞 10~15자(before)를 함께 제공해 위치를 특정하세요.
- 유형(type): "correction"(틀린 표현·문장을 고침), "highlight"(잘했거나 주목할 부분 강조), "comment"(구간에 대한 설명·질문).
- correction이면 suggestedText에 고친 문장을 넣으세요.
- comment(코멘트)는 한국어로 구체적이고 교육적으로 작성하세요.
- severity: "major"(중요한 문제), "minor"(사소한 문제), "suggestion"(제안).
- 5~12개 정도의 핵심적인 첨삭만 생성하세요. 사소한 모든 것을 표시하지 마세요.`;
}

function userPrompt(req: AnnotateRequest): string {
  return (
    `다음 학생 답안에 인라인 첨삭을 생성하세요.\n\n` +
    `논술 문제:\n${req.promptText}\n\n` +
    `평가 기준:\n${req.criteriaText}\n\n` +
    `학생 답안:\n${req.essayText}\n\n` +
    `반드시 아래 형식의 JSON 객체로만 응답하세요(설명·코드블록 금지):\n` +
    `{"annotations": [{"type": "correction"|"highlight"|"comment", "quotedText": string, "before": string, "suggestedText"?: string, "comment": string, "severity"?: "minor"|"major"|"suggestion"}]}`
  );
}

const ANNOTATION_SCHEMA = {
  type: "object",
  properties: {
    annotations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["correction", "highlight", "comment"] },
          quotedText: { type: "string" },
          before: { type: "string" },
          suggestedText: { type: "string" },
          comment: { type: "string" },
          severity: { type: "string", enum: ["minor", "major", "suggestion"] },
        },
        required: ["type", "quotedText", "comment"],
      },
    },
  },
  required: ["annotations"],
} as const;

function sanitize(raw: unknown): AiAnnotation[] {
  const list = (raw as { annotations?: unknown })?.annotations;
  if (!Array.isArray(list)) return [];
  const out: AiAnnotation[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const type = a.type;
    const quotedText = typeof a.quotedText === "string" ? a.quotedText : "";
    const comment = typeof a.comment === "string" ? a.comment : "";
    if (!quotedText || (type !== "correction" && type !== "highlight" && type !== "comment")) continue;
    out.push({
      type,
      quotedText,
      before: typeof a.before === "string" ? a.before : undefined,
      suggestedText: typeof a.suggestedText === "string" ? a.suggestedText : undefined,
      comment,
      severity:
        a.severity === "minor" || a.severity === "major" || a.severity === "suggestion" ? a.severity : undefined,
    });
  }
  return out;
}

async function annotateWithGemini(req: AnnotateRequest, modelId: string, timeoutMs: number): Promise<AiAnnotation[]> {
  const { GoogleGenAI } = await import("@google/genai");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey });

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelId,
          config: {
            systemInstruction: systemPrompt(),
            responseMimeType: "application/json",
            responseSchema: ANNOTATION_SCHEMA as unknown as Record<string, unknown>,
          },
          contents: [{ text: userPrompt(req) }],
        }),
        timeoutMs,
      );
      const rawJson = response.text || "";
      if (!rawJson) throw new Error("Gemini로부터 응답을 받지 못했습니다.");
      return sanitize(JSON.parse(rawJson));
    } catch (error) {
      lastError = error;
      console.error(`Gemini 첨삭 오류 (${modelId}, attempt ${attempt}/${MAX_RETRIES}):`, error);
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("첨삭 생성 중 오류가 발생했습니다.");
}

/** Pick the Gemini model for a tier (annotation always runs on Gemini). */
function geminiModelForTier(tier: ModelTier): string {
  return tier === "pro"
    ? process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro"
    : process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

/** Generate inline annotations for an essay (always Gemini structured output). */
export async function generateAnnotations(req: AnnotateRequest, tier: ModelTier): Promise<AnnotateResult> {
  const modelId = geminiModelForTier(tier);
  const annotations = await annotateWithGemini(req, modelId, TIMEOUT_MS);
  return { annotations, model: modelId, tier };
}
