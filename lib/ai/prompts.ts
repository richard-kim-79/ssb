import type { ContentPart, EssayAnalysisRequest, EssayAnalysisResponse } from "./types";

export function buildSystemPrompt(): string {
  return `당신은 한국의 논술 교육 전문가이자 숙련된 첨삭 교사입니다.

역할과 목표:
- 주어진 논술 문제와 평가 기준에 따라 학생의 답안을 정확하고 공정하게 평가합니다
- 교육적 가치가 있는 건설적인 피드백을 제공합니다
- 학생의 논리적 사고력, 표현력, 창의성을 종합적으로 평가합니다

평가 원칙:
1. 객관성: 개인적 편견 없이 공정하게 평가
2. 교육성: 학생의 성장에 도움이 되는 구체적 지침 제공
3. 체계성: 논리적 구성, 내용의 충실도, 표현력을 균형있게 평가
4. 건설성: 단순한 지적보다는 개선 방향 제시

응답 형식:
- JSON 형식으로 구조화된 평가 결과 제공
- 점수는 정확한 수치로, 피드백은 구체적이고 실용적으로 작성
- 긍정적 측면과 개선점을 균형있게 제시`;
}

const hasImageData = (text: string) => text.includes("[IMAGE_DATA:");

/**
 * Parse an IMAGE_DATA payload into inline image data.
 * New format (document.ts): "<mime>;base64,<b64>" — preserves the real mime type.
 * Legacy format: "<b64>" — pure base64, assume JPEG.
 */
function parseImagePayload(payload: string): { data: string; mimeType: string } {
  const m = /^([^;]+);base64,([\s\S]*)$/.exec(payload);
  if (m) return { mimeType: m[1], data: m[2] };
  return { mimeType: "image/jpeg", data: payload };
}

function processTextWithImages(text: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const imageRegex = /\[IMAGE_DATA:([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = imageRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textPart = text.substring(lastIndex, match.index);
      if (textPart.trim()) parts.push({ text: textPart });
    }
    parts.push({ inlineData: parseImagePayload(match[1]) });
    lastIndex = imageRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex);
    if (remaining.trim()) parts.push({ text: remaining });
  }
  return parts;
}

const EVAL_MARKER = "다음 사항을 중심으로";

function buildInstructions(): string {
  let t = "";
  t += `${EVAL_MARKER} 종합적으로 평가해주세요:\n\n`;
  t += `1. 전체 평가\n`;
  t += `   - 평가 기준에 명시된 만점 기준에 맞춰 총점을 산출하세요\n`;
  t += `   - 만약 평가 기준에 만점이 명시되어 있다면 (예: 8점 만점, 20점 만점 등), 반드시 그 만점을 기준으로 채점하세요\n`;
  t += `   - 만점 기준이 없다면 100점 만점으로 산출하세요\n`;
  t += `   - 영역별 세부 점수도 평가 기준에 명시된 배점에 맞춰 산출하세요\n`;
  t += `   - maxScore 필드에는 총 만점 점수를 반드시 포함하세요\n\n`;
  t += `2. 우수한 점 (3-5개)\n   - 학생이 잘 수행한 구체적 사항들\n\n`;
  t += `3. 개선이 필요한 점 (3-5개)\n   - 구체적인 문제점과 그 이유\n\n`;
  t += `4. 상세 첨삭\n   - 논리 구조, 내용, 표현 등에 대한 구체적 분석\n   - 교육적 가치가 있는 상세한 설명\n\n`;
  t += `5. 향후 개선 방안 (3-5개)\n   - 실행 가능한 구체적 개선 방법 제시\n\n`;
  t += `평가 시 고려사항:\n`;
  t += `- 제시된 평가 기준에 명시된 만점과 배점을 정확히 따를 것 (예: 8점 만점이면 8점, 20점 만점이면 20점으로 채점)\n`;
  t += `- 제시된 평가 기준의 세부 영역별 배점도 정확히 적용할 것\n`;
  t += `- 학생 수준에 맞는 적절한 기대치 설정\n`;
  t += `- 논리성, 창의성, 표현력의 균형 있는 평가\n`;
  t += `- 한국어 논술의 특성 반영 (격식체, 논리 전개 방식 등)`;
  return t;
}

/** Build the multimodal user prompt (mirrors the original Express implementation). */
export function buildUserPrompt(request: EssayAnalysisRequest): { parts: ContentPart[]; hasImages: boolean } {
  const { promptText, criteriaText, essayText, studentInfo } = request;
  const hasImages = hasImageData(promptText) || hasImageData(criteriaText) || hasImageData(essayText);

  let textPrompt = `논술 문제와 평가 기준에 따라 다음 학생 답안을 분석해주세요.\n\n`;
  if (studentInfo && (studentInfo.name || studentInfo.studentId)) {
    textPrompt += `학생 정보:\n`;
    if (studentInfo.name) textPrompt += `- 이름: ${studentInfo.name}\n`;
    if (studentInfo.studentId) textPrompt += `- 학번: ${studentInfo.studentId}\n`;
    textPrompt += `\n`;
  }

  const instructions = buildInstructions();

  // Simple path: no images.
  if (!hasImages) {
    textPrompt += `논술 문제:\n${promptText}\n\n`;
    textPrompt += `평가 기준:\n${criteriaText}\n\n`;
    textPrompt += `학생 답안:\n${essayText}\n\n`;
    textPrompt += instructions;
    return { parts: [{ text: textPrompt }], hasImages: false };
  }

  // Multimodal path: interleave text and images.
  const parts: ContentPart[] = [];
  parts.push({ text: textPrompt + `논술 문제:\n` });
  parts.push(...(hasImageData(promptText) ? processTextWithImages(promptText) : [{ text: `${promptText}\n\n` }]));
  parts.push({ text: `평가 기준:\n` });
  parts.push(...(hasImageData(criteriaText) ? processTextWithImages(criteriaText) : [{ text: `${criteriaText}\n\n` }]));
  parts.push({ text: `학생 답안:\n` });
  parts.push(...(hasImageData(essayText) ? processTextWithImages(essayText) : [{ text: `${essayText}\n\n` }]));
  parts.push({ text: `\n\n${instructions}` });
  return { parts, hasImages: true };
}

/** Does any part of the request carry inline image data? (text-only providers can't handle these.) */
export function requestHasImages(request: EssayAnalysisRequest): boolean {
  return hasImageData(request.promptText) || hasImageData(request.criteriaText) || hasImageData(request.essayText);
}

/** JSON-only output instruction for providers without a native response schema (e.g. Claude). */
export const JSON_INSTRUCTION =
  '\n\n반드시 아래 키를 가진 단일 JSON 객체로만 응답하세요(설명·코드블록 금지): ' +
  '{"overallScore": number, "maxScore": number, "categories": [{"name": string, "score": number, "maxScore": number, "feedback": string}], ' +
  '"strengths": string[], "improvementAreas": string[], "detailedFeedback": string, "suggestions": string[]}';

export function validateAnalysisResponse(response: EssayAnalysisResponse): void {
  const required: (keyof EssayAnalysisResponse)[] = [
    "overallScore",
    "maxScore",
    "categories",
    "strengths",
    "improvementAreas",
    "detailedFeedback",
    "suggestions",
  ];
  for (const field of required) {
    if (!(field in response)) throw new Error(`응답에 필수 필드가 누락되었습니다: ${field}`);
  }
  if (response.overallScore < 0 || response.overallScore > response.maxScore) {
    throw new Error(`점수가 유효 범위를 벗어났습니다: ${response.overallScore}/${response.maxScore}`);
  }
  if (!Array.isArray(response.categories) || response.categories.length === 0) throw new Error("영역별 평가가 없습니다.");
  if (!Array.isArray(response.strengths) || response.strengths.length === 0) throw new Error("우수한 점이 없습니다.");
  if (!Array.isArray(response.improvementAreas) || response.improvementAreas.length === 0)
    throw new Error("개선점이 없습니다.");
  if (!Array.isArray(response.suggestions) || response.suggestions.length === 0) throw new Error("개선 방안이 없습니다.");
  if (!response.detailedFeedback || response.detailedFeedback.trim().length < 50)
    throw new Error("상세 첨삭이 너무 짧습니다.");
}

/** JSON response schema shared by structured-output providers. */
export const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    overallScore: { type: "number" },
    maxScore: { type: "number" },
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          score: { type: "number" },
          maxScore: { type: "number" },
          feedback: { type: "string" },
        },
        required: ["name", "score", "maxScore", "feedback"],
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    improvementAreas: { type: "array", items: { type: "string" } },
    detailedFeedback: { type: "string" },
    suggestions: { type: "array", items: { type: "string" } },
  },
  required: [
    "overallScore",
    "maxScore",
    "categories",
    "strengths",
    "improvementAreas",
    "detailedFeedback",
    "suggestions",
  ],
} as const;

export { EVAL_MARKER };
