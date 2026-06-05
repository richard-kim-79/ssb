import { appBaseUrl } from "@/lib/queue/qstash";

export const runtime = "nodejs";

/** llms.txt — a concise machine-readable overview for LLM agents. */
export function GET() {
  const baseUrl = appBaseUrl();

  const body = `# 써봄 (EssayCritiqueAI)

> 한국어 논술·서술형 답안을 AI로 분석하고 채점하는 서비스입니다. 문제(지문)와 채점 기준을 입력하면 종합 점수, 항목별 점수, 강점·개선점, 상세 피드백을 제공합니다.

## GPT Actions API
API 키(\`sk_...\`)를 Authorization Bearer 헤더로 전달하여 사용합니다.

- [OpenAPI 스펙](${baseUrl}/openapi.json): GPT Actions용 OpenAPI 3.1 정의
- POST ${baseUrl}/api/gpt/analyze-essay: 기본 기준으로 답안 분석
- POST ${baseUrl}/api/gpt/analyze-essay-custom: 맞춤 문제·채점 기준으로 답안 분석
- GET ${baseUrl}/api/gpt/results/{submissionId}: 분석 결과 조회(폴링)

## Notes
- 분석은 비동기로 처리됩니다. analyze 호출 후 resultUrl을 폴링하세요.
- 사용량은 플랜에 따라 제한됩니다.
`;

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
