import type { EssayAnalysisRequest, EssayAnalysisResponse } from "./types";
import { buildSystemPrompt, buildUserText, requestHasImages, validateAnalysisResponse, JSON_INSTRUCTION } from "./prompts";
import { isRetryableError, sleep } from "./retry";

const MAX_RETRIES = Number(process.env.AI_MAX_RETRIES) || 3;
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");

interface ChatCompletion {
  choices?: Array<{ message?: { content?: string } }>;
}

/** Extract the first balanced JSON object (DeepSeek json_object mode usually returns clean JSON). */
function extractJson(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) throw new Error("DeepSeek 응답에서 JSON을 찾을 수 없습니다.");
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error("DeepSeek JSON 응답이 올바르지 않습니다.");
}

/**
 * Analyze an essay with DeepSeek (OpenAI-compatible chat completions, JSON mode).
 * Text-only: DeepSeek has no vision support, so image-based essays are rejected.
 * Retries transient failures with exponential backoff and enforces a per-attempt timeout.
 */
export async function analyzeWithDeepSeek(
  request: EssayAnalysisRequest,
  modelId: string,
  timeoutMs: number,
): Promise<EssayAnalysisResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");
  if (requestHasImages(request)) {
    throw new Error("DeepSeek는 이미지 답안을 지원하지 않습니다. 답안을 텍스트로 입력해주세요.");
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserText(request) + JSON_INSTRUCTION;

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
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

      const data = (await res.json()) as ChatCompletion;
      const rawJson = data.choices?.[0]?.message?.content || "";
      if (!rawJson) throw new Error("DeepSeek로부터 응답을 받지 못했습니다.");

      let result: EssayAnalysisResponse;
      try {
        result = JSON.parse(extractJson(rawJson));
      } catch {
        throw new Error("AI 응답을 처리할 수 없습니다. 다시 시도해주세요.");
      }
      validateAnalysisResponse(result);
      return result;
    } catch (error) {
      lastError = error instanceof Error && error.name === "AbortError"
        ? new Error(`AI 응답 시간이 초과되었습니다 (timeout ${timeoutMs}ms)`)
        : error;
      console.error(`DeepSeek 분석 오류 (${modelId}, attempt ${attempt}/${MAX_RETRIES}):`, lastError);
      if (attempt < MAX_RETRIES && isRetryableError(lastError)) {
        await sleep(1000 * 2 ** (attempt - 1)); // 1s, 2s, 4s
        continue;
      }
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastError instanceof Error) {
    if (/api key|unauthorized|\b401\b/i.test(lastError.message))
      throw new Error("AI 서비스 설정이 올바르지 않습니다. 관리자에게 문의하세요.");
    if (/quota|rate.?limit|\b429\b/i.test(lastError.message))
      throw new Error("AI 서비스 사용 한도가 초과되었습니다. 잠시 후 다시 시도해주세요.");
    throw lastError;
  }
  throw new Error("논술 분석 중 오류가 발생했습니다. 다시 시도해주세요.");
}
