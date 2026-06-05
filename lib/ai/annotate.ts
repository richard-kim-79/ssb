/**
 * AI inline 첨삭 (annotation) generation — the "red pen" half of the patch feature.
 *
 * Distinct from analyzeEssay (which produces an overall score + feedback): here the
 * model returns a list of span-level notes. Crucially, the model returns the *exact
 * quoted substring* (not char offsets — LLMs are unreliable at counting), plus a
 * short preceding-context hint to disambiguate duplicates. The server then anchors
 * each quote to real offsets (lib/patch/anchoring).
 *
 * Provider-agnostic over the configured providers: DeepSeek (text JSON mode) and
 * Gemini (structured output). Annotation is text-only, so it always runs on the
 * resolved base provider for the tier.
 */
import type { AiProvider, ModelTier } from "./types";
import { resolveModel } from "./modelTiering";
import { isRetryableError, sleep, withTimeout } from "./retry";

const MAX_RETRIES = Number(process.env.AI_MAX_RETRIES) || 3;
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");

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

function extractJson(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) throw new Error("AI 응답에서 JSON을 찾을 수 없습니다.");
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error("AI JSON 응답이 올바르지 않습니다.");
}

async function annotateWithDeepSeek(req: AnnotateRequest, modelId: string, timeoutMs: number): Promise<AiAnnotation[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: systemPrompt() },
            { role: "user", content: userPrompt(req) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 8192,
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`DeepSeek API 오류 ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const rawJson = data.choices?.[0]?.message?.content || "";
      if (!rawJson) throw new Error("DeepSeek로부터 응답을 받지 못했습니다.");
      return sanitize(JSON.parse(extractJson(rawJson)));
    } catch (error) {
      lastError =
        error instanceof Error && error.name === "AbortError"
          ? new Error(`AI 응답 시간이 초과되었습니다 (timeout ${timeoutMs}ms)`)
          : error;
      console.error(`DeepSeek 첨삭 오류 (${modelId}, attempt ${attempt}/${MAX_RETRIES}):`, lastError);
      if (attempt < MAX_RETRIES && isRetryableError(lastError)) {
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("첨삭 생성 중 오류가 발생했습니다.");
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

/** Generate inline annotations for an essay (text-only). */
export async function generateAnnotations(req: AnnotateRequest, tier: ModelTier): Promise<AnnotateResult> {
  const resolved = resolveModel(tier); // text-only → base provider for the tier
  const provider: AiProvider = resolved.provider;
  const annotations =
    provider === "deepseek"
      ? await annotateWithDeepSeek(req, resolved.modelId, resolved.timeoutMs)
      : await annotateWithGemini(req, resolved.modelId, resolved.timeoutMs);
  return { annotations, model: resolved.modelId, tier: resolved.tier };
}
