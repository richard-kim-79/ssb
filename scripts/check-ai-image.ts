/**
 * Image grading smoke check — grades an essay IMAGE through the multimodal path.
 * Proves that [IMAGE_DATA:...] answers are parsed and graded by a vision-capable
 * provider (Gemini), and that the base64 payload is decoded correctly.
 * Requires GEMINI_API_KEY.
 *
 *   npm run check:ai:image -- /path/to/essay.png
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { analyzeEssay } from "@/lib/ai";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

async function main() {
  const imgPath = process.argv[2] || "/tmp/essay.png";
  const ext = extname(imgPath).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`지원하지 않는 이미지 형식: ${ext} (png/jpg/jpeg/webp만 가능)`);

  const b64 = readFileSync(imgPath).toString("base64");
  const essayText = `[IMAGE_DATA:${mime};base64,${b64}]`;
  console.log(`grading image: ${imgPath} (${mime}, ${(b64.length / 1024).toFixed(0)}KB base64)`);

  const t0 = Date.now();
  const { result, model, tier } = await analyzeEssay(
    {
      promptText: "인공지능이 교육에 미치는 영향에 대해 자신의 견해를 논하시오.",
      criteriaText: "주장의 명확성(25), 논리적 근거(25), 구성과 흐름(25), 표현과 어휘(25). 총 100점.",
      essayText,
      studentInfo: { name: "테스트" },
    },
    "flash",
  );

  const routed = model.includes("gemini") || model.includes("claude");
  console.log(`\n✓ image graded in ${((Date.now() - t0) / 1000).toFixed(1)}s  model=${model} tier=${tier}`);
  console.log(`  vision routing: ${routed ? `${model} ✓ (text-only base provider was bypassed)` : `⚠ ${model}`}`);
  console.log(`  score: ${result.overallScore} / ${result.maxScore}`);
  console.log(`  categories: ${result.categories.map((c) => `${c.name} ${c.score}/${c.maxScore}`).join(", ")}`);
  console.log(`  feedback (${result.detailedFeedback.length} chars): ${result.detailedFeedback.slice(0, 140)}...`);
}

main().catch((e) => {
  console.error("\n✗ image check failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
