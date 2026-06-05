/**
 * Standalone seed runner: `npm run db:seed`.
 * Loads env, seeds subscription plans, exits.
 */
import "dotenv/config";
import { seedPlans } from "@/lib/db/seed";

async function main() {
  const { inserted } = await seedPlans();
  if (inserted > 0) {
    console.log(`✅ ${inserted}개의 구독 플랜을 시드했습니다`);
  } else {
    console.log("✅ 구독 플랜이 이미 존재합니다 (시드 건너뜀)");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("시드 실패:", err);
  process.exit(1);
});
