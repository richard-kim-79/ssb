/**
 * Environment doctor. Reports which env vars are present so you can see, at a
 * glance, what is ready and what still blocks each capability.
 *
 *   npm run check:env
 *
 * Reads .env.local then .env (same precedence drizzle.config.ts uses).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

interface Group {
  title: string;
  enables: string;
  vars: { name: string; required: boolean }[];
}

const groups: Group[] = [
  {
    title: "Core (required for local end-to-end verification)",
    enables: "register/login, sessions, submit, AI grading via dev fallback",
    vars: [
      { name: "DATABASE_URL", required: true },
      { name: "DIRECT_DATABASE_URL", required: true },
      { name: "AUTH_SECRET", required: true },
      { name: "GEMINI_API_KEY", required: true },
    ],
  },
  {
    title: "Storage (only for file uploads — text paste works without it)",
    enables: "docx/pdf/image upload + downloads via Supabase Storage",
    vars: [
      { name: "SUPABASE_URL", required: false },
      { name: "SUPABASE_SERVICE_ROLE_KEY", required: false },
      { name: "SUPABASE_STORAGE_BUCKET", required: false },
    ],
  },
  {
    title: "Queue (production durability — dev runs grading in-process without it)",
    enables: "QStash durable retries for grade/regrade/annotate workers",
    vars: [
      { name: "QSTASH_TOKEN", required: false },
      { name: "QSTASH_CURRENT_SIGNING_KEY", required: false },
      { name: "QSTASH_NEXT_SIGNING_KEY", required: false },
    ],
  },
  {
    title: "Premium AI (optional upgrade tier)",
    enables: "Claude / Gemini Pro for paid plans",
    vars: [
      { name: "ANTHROPIC_API_KEY", required: false },
      { name: "PREMIUM_PROVIDER", required: false },
    ],
  },
  {
    title: "Payments + Cron (only when wiring Toss billing)",
    enables: "Toss create-intent/confirm/billing + Vercel Cron auto-renewal",
    vars: [
      { name: "TOSS_SECRET_KEY", required: false },
      { name: "NEXT_PUBLIC_TOSS_CLIENT_KEY", required: false },
      { name: "CRON_SECRET", required: false },
    ],
  },
];

console.log(c.bold("\n써봄 environment doctor\n"));

let missingRequired = 0;
for (const g of groups) {
  console.log(c.bold(g.title));
  console.log(c.dim(`  → ${g.enables}`));
  for (const v of g.vars) {
    const present = !!process.env[v.name] && process.env[v.name] !== "";
    const tag = present ? c.green("set    ") : v.required ? c.red("MISSING") : c.yellow("unset  ");
    if (!present && v.required) missingRequired += 1;
    console.log(`    ${tag}  ${v.name}`);
  }
  console.log("");
}

if (missingRequired > 0) {
  console.log(c.red(c.bold(`✗ ${missingRequired} required var(s) missing — local verification will fail.`)));
  console.log(c.dim("  Fill them in .env.local, then: npm run db:push && npm run db:seed && npm run dev && npm run smoke\n"));
  process.exit(1);
}
console.log(c.green(c.bold("✓ All required vars present.")));
console.log(c.dim("  Next: npm run db:push && npm run db:seed && npm run dev (then in another terminal) npm run smoke\n"));
process.exit(0);
