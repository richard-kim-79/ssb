import Link from "next/link";
import { Button, Card } from "@/components/ui";

const STEPS = [
  { n: "1", title: "문제 + 채점 기준 등록", desc: "논술 문제와 평가 기준을 txt·docx·pdf·이미지 파일로 올립니다." },
  { n: "2", title: "학생 답안 제출", desc: "txt·docx·pdf·사진(손글씨) 파일로 답안을 올립니다." },
  { n: "3", title: "AI 채점 + 첨삭", desc: "총점·영역별 점수·강점·개선점·상세 피드백을 받아봅니다." },
];

const FEATURES = [
  { title: "기준 맞춤 채점", desc: "직접 정한 배점·만점에 맞춰 채점합니다. 8점 만점이면 8점 기준으로." },
  { title: "이미지 답안 지원", desc: "손글씨 답안을 사진으로 올리면 자동으로 인식해 채점합니다." },
  { title: "상세 피드백", desc: "강점·개선점·실행 가능한 개선 방안까지 구체적으로 제시합니다." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 py-20 text-center">
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          한국어 AI 논술 첨삭·채점
        </span>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          논술 답안을 올리면,
          <br />
          AI가 채점하고 첨삭합니다
        </h1>
        <p className="max-w-xl text-lg leading-8 text-slate-600">
          문제와 채점 기준을 등록하고 학생 답안을 제출하세요. 총점과 영역별 점수, 상세한 피드백을 몇 초 만에 받아볼 수
          있습니다.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/register">
            <Button size="lg">무료로 시작하기</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="secondary">
              로그인
            </Button>
          </Link>
        </div>
      </section>

      {/* Steps */}
      <section className="py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <Card key={s.n} className="p-6">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 font-semibold text-white">
                {s.n}
              </div>
              <h3 className="mb-1 font-semibold text-slate-900">{s.title}</h3>
              <p className="text-sm leading-6 text-slate-600">{s.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-12">
        <h2 className="mb-6 text-center text-2xl font-bold text-slate-900">무엇이 다른가요?</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-6">
              <h3 className="mb-1 font-semibold text-slate-900">{f.title}</h3>
              <p className="text-sm leading-6 text-slate-600">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="my-12 rounded-2xl bg-indigo-600 px-6 py-12 text-center text-white">
        <h2 className="text-2xl font-bold">지금 바로 채점을 시작해보세요</h2>
        <p className="mt-2 text-indigo-100">회원가입 후 무료 체험으로 답안을 채점할 수 있습니다.</p>
        <Link href="/register" className="mt-6 inline-block">
          <Button size="lg" variant="secondary">
            무료로 시작하기
          </Button>
        </Link>
      </section>

      <footer className="no-print border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        <nav className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/plans" className="hover:text-slate-600">
            요금제
          </Link>
          <Link href="/blog" className="hover:text-slate-600">
            블로그
          </Link>
          <Link href="/gpt-guide" className="hover:text-slate-600">
            GPT 연동
          </Link>
          <Link href="/privacy" className="hover:text-slate-600">
            개인정보처리방침
          </Link>
          <Link href="/terms" className="hover:text-slate-600">
            이용약관
          </Link>
        </nav>
        © {new Date().getFullYear()} 써봄 · 한국어 AI 논술 첨삭·채점
      </footer>
    </main>
  );
}
