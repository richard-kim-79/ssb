import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/seo";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Custom GPT 연동 가이드",
  description:
    "ChatGPT의 Custom GPT와 써봄을 연동해 AI 논술 첨삭을 활용하는 방법을 단계별로 안내합니다. API 키 발급부터 GPT Actions 설정까지.",
  alternates: { canonical: "/gpt-guide" },
};

const openapiUrl = `${SITE_URL}/openapi.json`;

const exampleInstructions = `당신은 한국어 에세이 첨삭 전문가입니다.
학생들의 에세이를 분석하고 건설적인 피드백을 제공합니다.

사용자가 에세이를 제출하면:
1. analyzeEssay action을 사용하여 에세이를 분석합니다
2. 분석 결과가 나올 때까지 기다립니다 (약 30초 소요)
3. 결과를 한국어로 친절하게 설명합니다

평가 기준:
- 논리적 구조
- 논증의 타당성
- 근거의 신빙성
- 언어 표현

항상 긍정적이고 건설적인 톤을 유지하세요.`;

export default function GptGuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm font-medium text-indigo-600 hover:underline">
        ← 홈으로
      </Link>

      <header className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Custom GPT 연동 가이드</h1>
        <p className="mt-3 text-slate-600">
          ChatGPT의 Custom GPT 기능과 써봄을 연동하여 AI 첨삭 서비스를 활용하는 방법입니다.
        </p>
      </header>

      <div className="mt-8 space-y-5">
        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-900">1단계: API 키 생성</h2>
          <p className="mt-1 text-sm text-slate-500">
            Custom GPT와 통신하기 위한 API 키를 먼저 생성하세요.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>
              <Link href="/api-keys" className="font-medium text-indigo-600 hover:underline">
                API 키 관리 페이지
              </Link>
              에서 &quot;새 API 키 생성&quot; 버튼 클릭
            </li>
            <li>API 키 이름 입력 (예: &quot;Custom GPT 연동용&quot;)</li>
            <li>생성된 API 키를 안전한 곳에 복사 (한 번만 표시됨)</li>
          </ol>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-900">2단계: Custom GPT 생성</h2>
          <p className="mt-1 text-sm text-slate-500">ChatGPT에서 새로운 Custom GPT를 생성하세요.</p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>
              <a
                href="https://chat.openai.com/gpts/editor"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-indigo-600 hover:underline"
              >
                ChatGPT GPT Builder
              </a>
              에 접속
            </li>
            <li>&quot;Create a GPT&quot; 클릭</li>
            <li>GPT 이름과 설명 작성 (예: &quot;써봄 AI 첨삭 도우미&quot;)</li>
          </ol>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-900">3단계: GPT Actions 설정</h2>
          <p className="mt-1 text-sm text-slate-500">Custom GPT에 써봄 API를 연결하세요.</p>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-700">
            <li>GPT Editor에서 &quot;Configure&quot; 탭 선택</li>
            <li>&quot;Actions&quot; 섹션으로 스크롤하여 &quot;Create new action&quot; 클릭</li>
            <li>
              아래 OpenAPI 스펙 URL을 &quot;Import from URL&quot;에 입력:
              <div className="mt-2 break-all rounded-md bg-slate-900 p-3 font-mono text-xs text-slate-100">
                {openapiUrl}
              </div>
            </li>
            <li>Authentication 섹션에서 &quot;API Key&quot; 선택</li>
            <li>Auth Type: &quot;Bearer&quot;</li>
            <li>API Key 입력란에 1단계에서 생성한 API 키 붙여넣기</li>
            <li>&quot;Save&quot; 클릭하여 저장</li>
          </ol>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-900">4단계: GPT Instructions 작성</h2>
          <p className="mt-1 text-sm text-slate-500">GPT가 어떻게 동작할지 지시사항을 작성하세요.</p>
          <p className="mt-4 text-sm text-slate-700">
            Instructions 섹션에 아래 예시를 참고하여 작성하세요:
          </p>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
            {exampleInstructions}
          </pre>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-900">5단계: 테스트 및 배포</h2>
          <p className="mt-1 text-sm text-slate-500">생성한 Custom GPT를 테스트하고 사용하세요.</p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>GPT Editor의 &quot;Preview&quot; 영역에서 테스트 메시지 입력</li>
            <li>예시: &quot;다음 에세이를 첨삭해주세요: [에세이 텍스트]&quot;</li>
            <li>정상 작동 확인 후 &quot;Save&quot; 클릭</li>
            <li>공유 범위 선택 (Only me / Anyone with the link / Public)</li>
            <li>&quot;Confirm&quot; 클릭하여 배포</li>
          </ol>
        </Card>

        <Card className="border-indigo-200 p-6">
          <h2 className="text-lg font-bold text-slate-900">주의사항</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>API 키는 절대 공개하지 마세요.</li>
            <li>
              Custom GPT를 Public으로 설정하면 다른 사용자도 귀하의 API 키로 요청을 보낼 수 있습니다.
            </li>
            <li>API 호출은 귀하의 구독 플랜 사용량에 포함됩니다.</li>
            <li>의심스러운 활동이 있다면 즉시 API 키를 삭제하고 새로 생성하세요.</li>
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-900">API 엔드포인트</h2>
          <p className="mt-1 text-sm text-slate-500">Custom GPT에서 사용할 수 있는 API 엔드포인트입니다.</p>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="font-medium text-slate-800">1. 기본 분석 (기본 평가 기준 사용)</p>
              <code className="mt-1 block rounded bg-slate-100 px-2 py-1.5 font-mono text-xs text-slate-700">
                POST /api/gpt/analyze-essay
              </code>
            </div>
            <div>
              <p className="font-medium text-slate-800">2. 커스텀 분석 (사용자 지정 평가 기준)</p>
              <code className="mt-1 block rounded bg-slate-100 px-2 py-1.5 font-mono text-xs text-slate-700">
                POST /api/gpt/analyze-essay-custom
              </code>
            </div>
            <div>
              <p className="font-medium text-slate-800">3. 결과 조회</p>
              <code className="mt-1 block rounded bg-slate-100 px-2 py-1.5 font-mono text-xs text-slate-700">
                GET /api/gpt/results/&#123;submissionId&#125;
              </code>
            </div>
            <div className="pt-1">
              <a
                href="/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                전체 OpenAPI 스펙 보기 →
              </a>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
