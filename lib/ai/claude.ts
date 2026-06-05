import type { ContentPart, EssayAnalysisRequest, EssayAnalysisResponse } from "./types";
import { buildSystemPrompt, buildUserPrompt, validateAnalysisResponse } from "./prompts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

type ClaudeBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

function toClaudeBlocks(parts: ContentPart[]): ClaudeBlock[] {
  return parts.map((p) =>
    "text" in p
      ? { type: "text", text: p.text }
      : { type: "image", source: { type: "base64", media_type: p.inlineData.mimeType, data: p.inlineData.data } },
  );
}

/** Extract the first balanced JSON object from a string. */
function extractJson(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) throw new Error("Claude 응답에서 JSON을 찾을 수 없습니다.");
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error("Claude JSON 응답이 올바르지 않습니다.");
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`AI 응답 시간이 초과되었습니다 (timeout ${ms}ms)`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

const JSON_INSTRUCTION =
  '\n\n반드시 아래 키를 가진 단일 JSON 객체로만 응답하세요(설명·코드블록 금지): ' +
  '{"overallScore": number, "maxScore": number, "categories": [{"name": string, "score": number, "maxScore": number, "feedback": string}], ' +
  '"strengths": string[], "improvementAreas": string[], "detailedFeedback": string, "suggestions": string[]}';

/** Analyze an essay with Anthropic Claude (premium tier, via fetch — no SDK dependency). */
export async function analyzeWithClaude(
  request: EssayAnalysisRequest,
  modelId: string,
  timeoutMs: number,
): Promise<EssayAnalysisResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const { parts } = buildUserPrompt(request);
  const blocks = toClaudeBlocks(parts);
  blocks.push({ type: "text", text: JSON_INSTRUCTION });

  const res = await withTimeout(
    fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 4096,
        system: buildSystemPrompt(),
        messages: [{ role: "user", content: blocks }],
      }),
    }),
    timeoutMs,
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Claude API 오류 ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.map((c) => c.text || "").join("") || "";
  const result = JSON.parse(extractJson(text)) as EssayAnalysisResponse;
  validateAnalysisResponse(result);
  return result;
}
