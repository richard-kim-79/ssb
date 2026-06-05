/**
 * AI provider smoke check — grades one sample essay against the configured
 * provider (AI_PROVIDER) without needing a database. Confirms the AI key/model
 * works on its own.
 *
 *   npm run check:ai
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { analyzeEssay, resolveTier, resolveModel } from "@/lib/ai";

async function main() {
  const tier = resolveTier(null); // flash tier
  console.log("resolved model:", resolveModel(tier));

  const t0 = Date.now();
  const { result, model, tier: used } = await analyzeEssay(
    {
      promptText: "인공지능이 교육에 미치는 영향에 대해 자신의 견해를 논하시오.",
      criteriaText: "주장의 명확성(25), 논리적 근거(25), 구성과 흐름(25), 표현과 어휘(25). 총 100점.",
      essayText:
        "인공지능은 교육의 모습을 근본적으로 바꾸고 있다. 첫째, 맞춤형 학습은 학생 개개인의 수준에 맞춘 피드백을 제공한다. " +
        "이는 기존의 일률적 수업이 해결하지 못한 학습 격차를 완화한다. 둘째, 교사는 반복 업무에서 벗어나 학생과의 상호작용에 집중할 수 있다. " +
        "그러나 과도한 의존은 비판적 사고력을 약화시킬 위험이 있다. 따라서 인공지능은 교육을 대체하는 것이 아니라 보조하는 도구로 활용되어야 한다. " +
        "결론적으로 인공지능과 인간 교사의 협력이 미래 교육의 핵심이 될 것이다.",
      studentInfo: { name: "테스트" },
    },
    tier,
  );

  console.log(`\n✓ DeepSeek graded in ${((Date.now() - t0) / 1000).toFixed(1)}s  model=${model} tier=${used}`);
  console.log(`  score: ${result.overallScore} / ${result.maxScore}`);
  console.log(`  categories: ${result.categories.map((c) => `${c.name} ${c.score}/${c.maxScore}`).join(", ")}`);
  console.log(`  strengths: ${result.strengths.length}, improvements: ${result.improvementAreas.length}, suggestions: ${result.suggestions.length}`);
  console.log(`  feedback (${result.detailedFeedback.length} chars): ${result.detailedFeedback.slice(0, 120)}...`);
}

main().catch((e) => {
  console.error("\n✗ DeepSeek check failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
