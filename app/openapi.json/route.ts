import { appBaseUrl } from "@/lib/queue/qstash";

export const runtime = "nodejs";

/** OpenAPI 3.1 spec describing the GPT Actions endpoints (for ChatGPT custom GPTs). */
export function GET() {
  const baseUrl = appBaseUrl();

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "써봄 (EssayCritiqueAI) GPT Actions API",
      description: "API 키로 인증하여 답안을 분석하고 채점 결과를 받아옵니다.",
      version: "1.0.0",
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: "http", scheme: "bearer", bearerFormat: "sk_..." },
      },
      schemas: {
        AnalyzeStarted: {
          type: "object",
          properties: {
            submissionId: { type: "string" },
            sessionId: { type: "string" },
            status: { type: "string" },
            message: { type: "string" },
            resultUrl: { type: "string" },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      "/api/gpt/analyze-essay": {
        post: {
          operationId: "analyzeEssay",
          summary: "기본 기준으로 답안 분석",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["essay"],
                  properties: {
                    essay: { type: "string", description: "분석할 답안 텍스트" },
                    studentName: { type: "string" },
                    studentId: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "202": {
              description: "분석 시작됨",
              content: { "application/json": { schema: { $ref: "#/components/schemas/AnalyzeStarted" } } },
            },
          },
        },
      },
      "/api/gpt/analyze-essay-custom": {
        post: {
          operationId: "analyzeEssayCustom",
          summary: "맞춤 문제·채점 기준으로 답안 분석",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["essay", "prompt", "criteria"],
                  properties: {
                    essay: { type: "string", description: "분석할 답안 텍스트" },
                    prompt: { type: "string", description: "문제(지문) 내용" },
                    criteria: { type: "string", description: "채점 기준" },
                    studentName: { type: "string" },
                    studentId: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "202": {
              description: "분석 시작됨",
              content: { "application/json": { schema: { $ref: "#/components/schemas/AnalyzeStarted" } } },
            },
          },
        },
      },
      "/api/gpt/results/{submissionId}": {
        get: {
          operationId: "getAnalysisResult",
          summary: "분석 결과 조회 (폴링)",
          parameters: [
            {
              name: "submissionId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "진행 상태 또는 완료된 결과" },
            "404": { description: "제출물 또는 결과 없음" },
          },
        },
      },
    },
  };

  return Response.json(spec);
}
