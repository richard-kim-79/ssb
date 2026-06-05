import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "써봄(연주미디어)의 개인정보 수집·이용·보관·파기 및 위탁에 관한 처리방침입니다.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm font-medium text-indigo-600 hover:underline">
        ← 홈으로
      </Link>

      <header className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">개인정보처리방침</h1>
        <p className="mt-2 text-sm text-slate-400">최종 수정일: 2024년 10월 24일</p>
      </header>

      <div className="mt-8 space-y-10 text-slate-700">
        <section>
          <h2 className="text-xl font-bold text-slate-900">제1조 (목적)</h2>
          <p className="mt-3 leading-7 text-slate-600">
            연주미디어(이하 &quot;회사&quot;)는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」, 「정보통신망
            이용촉진 및 정보보호 등에 관한 법률」 등 관련 법령을 준수하고 있습니다. 회사는 개인정보처리방침을
            통하여 이용자가 제공하는 개인정보가 어떠한 용도와 방식으로 이용되고 있으며, 개인정보보호를 위해
            어떠한 조치가 취해지고 있는지 알려드립니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900">
            제2조 (수집하는 개인정보의 항목 및 수집방법)
          </h2>
          <h3 className="mt-5 text-lg font-semibold text-slate-900">1. 수집하는 개인정보의 항목</h3>
          <div className="mt-3">
            <p className="font-semibold text-slate-800">가. 회원가입 시</p>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-slate-600">
              <li>필수항목: 이메일 주소, 비밀번호, 사용자명</li>
              <li>선택항목: 없음</li>
            </ul>
          </div>
          <div className="mt-4">
            <p className="font-semibold text-slate-800">나. 서비스 이용 시</p>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-slate-600">
              <li>업로드한 논술 문제 및 기준 파일</li>
              <li>학생 답안 파일</li>
              <li>AI 분석 결과 및 첨삭 데이터</li>
              <li>서비스 이용 기록, 접속 로그, IP 주소</li>
            </ul>
          </div>
          <div className="mt-4">
            <p className="font-semibold text-slate-800">다. 결제 시</p>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-slate-600">
              <li>결제 정보는 토스페이먼츠를 통해 처리되며, 회사는 결제 완료 정보만 수신합니다</li>
              <li>카드번호, 유효기간 등 민감한 결제정보는 회사가 직접 보관하지 않습니다</li>
            </ul>
          </div>
          <h3 className="mt-5 text-lg font-semibold text-slate-900">2. 개인정보 수집방법</h3>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-slate-600">
            <li>웹사이트를 통한 회원가입 및 서비스 이용</li>
            <li>파일 업로드 및 서비스 이용 과정</li>
            <li>고객센터를 통한 상담 과정</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900">제3조 (개인정보의 수집 및 이용목적)</h2>
          <p className="mt-3 leading-7 text-slate-600">회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.</p>
          <div className="mt-4">
            <p className="font-semibold text-slate-800">1. 서비스 제공</p>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-slate-600">
              <li>AI 논술 첨삭 서비스 제공</li>
              <li>문제 및 기준 업로드, 답안 제출, 분석 결과 제공</li>
              <li>맞춤형 학습 피드백 제공</li>
            </ul>
          </div>
          <div className="mt-4">
            <p className="font-semibold text-slate-800">2. 회원 관리</p>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-slate-600">
              <li>회원제 서비스 이용에 따른 본인확인, 개인 식별</li>
              <li>불법적 이용 방지 및 비인가 사용 방지</li>
              <li>가입의사 확인, 연령확인</li>
              <li>불만처리 등 민원처리, 고지사항 전달</li>
            </ul>
          </div>
          <div className="mt-4">
            <p className="font-semibold text-slate-800">3. 요금 결제 및 정산</p>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-slate-600">
              <li>구독 서비스 이용에 대한 요금 결제</li>
              <li>정기결제 처리 및 결제 내역 관리</li>
              <li>환불 처리</li>
            </ul>
          </div>
          <div className="mt-4">
            <p className="font-semibold text-slate-800">4. 서비스 개선</p>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-slate-600">
              <li>신규 서비스 개발 및 기존 서비스 개선</li>
              <li>통계학적 특성에 따른 서비스 제공 및 광고 게재</li>
              <li>서비스 이용 통계 분석</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900">제4조 (개인정보의 보유 및 이용기간)</h2>
          <p className="mt-3 leading-7 text-slate-600">
            회사는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단,
            다음의 정보에 대해서는 아래의 이유로 명시한 기간 동안 보존합니다.
          </p>
          <div className="mt-4">
            <p className="font-semibold text-slate-800">1. 회사 내부 방침에 의한 정보보유 사유</p>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-slate-600">
              <li>부정 이용 기록: 1년 (부정 이용 방지)</li>
              <li>서비스 이용 기록: 회원 탈퇴 시까지</li>
            </ul>
          </div>
          <div className="mt-4">
            <p className="font-semibold text-slate-800">2. 관련 법령에 의한 정보보유 사유</p>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-slate-600">
              <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
              <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</li>
              <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
              <li>웹사이트 방문 기록: 3개월 (통신비밀보호법)</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900">제5조 (개인정보의 파기절차 및 방법)</h2>
          <div className="mt-4">
            <p className="font-semibold text-slate-800">1. 파기절차</p>
            <p className="mt-1 leading-7 text-slate-600">
              이용자가 회원가입 등을 위해 입력한 정보는 목적이 달성된 후 별도의 DB로 옮겨져 내부 방침 및 기타
              관련 법령에 의한 정보보호 사유에 따라 일정 기간 저장된 후 파기됩니다.
            </p>
          </div>
          <div className="mt-4">
            <p className="font-semibold text-slate-800">2. 파기방법</p>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-slate-600">
              <li>전자적 파일 형태의 정보: 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제</li>
              <li>종이에 출력된 개인정보: 분쇄기로 분쇄하거나 소각</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900">제6조 (개인정보의 제3자 제공)</h2>
          <p className="mt-3 leading-7 text-slate-600">
            회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 아래의 경우에는 예외로
            합니다.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-slate-600">
            <li>이용자가 사전에 동의한 경우</li>
            <li>
              법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는
              경우
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900">제7조 (개인정보 처리의 위탁)</h2>
          <p className="mt-3 leading-7 text-slate-600">
            회사는 서비스 향상을 위해 아래와 같이 개인정보를 위탁하고 있으며, 관계 법령에 따라 위탁계약 시
            개인정보가 안전하게 관리될 수 있도록 필요한 사항을 규정하고 있습니다.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">
                    수탁업체
                  </th>
                  <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">
                    위탁업무 내용
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                <tr>
                  <td className="border border-slate-200 px-3 py-2">토스페이먼츠</td>
                  <td className="border border-slate-200 px-3 py-2">결제 처리 및 결제 정보 관리</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-2">Google (Gemini API)</td>
                  <td className="border border-slate-200 px-3 py-2">AI 논술 분석·첨삭 서비스 제공</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-2">Anthropic (Claude API)</td>
                  <td className="border border-slate-200 px-3 py-2">프리미엄 AI 논술 분석·첨삭 서비스 제공</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-2">Supabase</td>
                  <td className="border border-slate-200 px-3 py-2">데이터베이스 및 파일 저장소 호스팅·관리</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-2">Vercel</td>
                  <td className="border border-slate-200 px-3 py-2">애플리케이션 호스팅 및 운영</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-2">Upstash</td>
                  <td className="border border-slate-200 px-3 py-2">비동기 작업 처리(채점 큐) 관리</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900">제8조 (이용자의 권리와 행사방법)</h2>
          <p className="mt-3 leading-7 text-slate-600">
            이용자는 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-slate-600">
            <li>개인정보 열람 요구</li>
            <li>개인정보에 오류가 있을 경우 정정 요구</li>
            <li>개인정보 삭제 요구</li>
            <li>개인정보 처리 정지 요구</li>
          </ul>
          <p className="mt-4 leading-7 text-slate-600">
            위 권리 행사는 고객센터를 통해 하실 수 있으며, 회사는 이에 대해 지체 없이 조치하겠습니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900">제9조 (개인정보 보호책임자)</h2>
          <p className="mt-3 leading-7 text-slate-600">
            회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 이용자의 불만처리 및
            피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
          </p>
          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <p className="font-semibold text-slate-800">개인정보 보호책임자</p>
            <ul className="mt-2 space-y-1 text-slate-600">
              <li>성명: 김민용</li>
              <li>직책: 대표</li>
              <li>연락처: 010-4298-0701</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900">제10조 (개인정보처리방침의 변경)</h2>
          <p className="mt-3 leading-7 text-slate-600">
            이 개인정보처리방침은 2024년 10월 24일부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및
            정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900">제11조 (개인정보의 안전성 확보조치)</h2>
          <p className="mt-3 leading-7 text-slate-600">
            회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-slate-600">
            <li>관리적 조치: 내부관리계획 수립·시행, 정기적 직원 교육</li>
            <li>
              기술적 조치: 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 개인정보의 암호화,
              보안프로그램 설치
            </li>
            <li>물리적 조치: 전산실, 자료보관실 등의 접근통제</li>
          </ul>
        </section>

        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-sm text-slate-500">
            본 개인정보처리방침에 대한 문의사항이 있으시면 고객센터(010-4298-0701)로 연락주시기 바랍니다.
          </p>
        </div>
      </div>
    </main>
  );
}
