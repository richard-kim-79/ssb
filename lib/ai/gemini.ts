import { GoogleGenAI } from "@google/genai";
import type { EssayAnalysisRequest, EssayAnalysisResponse } from "./types";
import { ANALYSIS_JSON_SCHEMA, buildSystemPrompt, buildUserPrompt, validateAnalysisResponse } from "./prompts";

const MAX_RETRIES = Number(process.env.GEMINI_MAX_RETRIES) || 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /timeout|timed out|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|network/i.test(msg) ||
    /\b429\b|quota|rate.?limit|overloaded|unavailable|\b50[0-4]\b/i.test(msg)
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`AI 응답 시간이 초과되었습니다 (timeout ${ms}ms)`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

/**
 * Analyze an essay with Gemini structured output.
 * Retries transient failures with exponential backoff and enforces a timeout per attempt.
 */
export async function analyzeWithGemini(
  request: EssayAnalysisRequest,
  modelId: string,
  timeoutMs: number,
): Promise<EssayAnalysisResponse> {
  const ai = getClient();
  const systemPrompt = buildSystemPrompt();
  const { parts } = buildUserPrompt(request);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelId,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: ANALYSIS_JSON_SCHEMA as unknown as Record<string, unknown>,
          },
          contents: parts,
        }),
        timeoutMs,
      );

      const rawJson = response.text || "";
      if (!rawJson) throw new Error("Gemini로부터 응답을 받지 못했습니다.");

      let result: EssayAnalysisResponse;
      try {
        result = JSON.parse(rawJson);
      } catch {
        throw new Error("AI 응답을 처리할 수 없습니다. 다시 시도해주세요.");
      }
      validateAnalysisResponse(result);
      return result;
    } catch (error) {
      lastError = error;
      console.error(`Gemini 분석 오류 (${modelId}, attempt ${attempt}/${MAX_RETRIES}):`, error);
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        await sleep(1000 * 2 ** (attempt - 1)); // 1s, 2s, 4s
        continue;
      }
      break;
    }
  }

  if (lastError instanceof Error) {
    if (lastError.message.includes("API key")) throw new Error("AI 서비스 설정이 올바르지 않습니다. 관리자에게 문의하세요.");
    if (/quota|rate.?limit|\b429\b/i.test(lastError.message))
      throw new Error("AI 서비스 사용 한도가 초과되었습니다. 잠시 후 다시 시도해주세요.");
    throw lastError;
  }
  throw new Error("논술 분석 중 오류가 발생했습니다. 다시 시도해주세요.");
}
