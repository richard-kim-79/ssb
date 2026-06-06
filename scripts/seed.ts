/**
 * Standalone seed runner: `npm run db:seed`.
 * Loads env, seeds subscription plans, exits.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { seedPlans } from "@/lib/db/seed";

async function main() {
  const { upserted } = await seedPlans();
  console.log(`✅ ${upserted}개의 구독 플랜을 동기화했습니다 (upsert)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("시드 실패:", err);
  process.exit(1);
});
