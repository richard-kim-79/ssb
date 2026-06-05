/**
 * End-to-end smoke test for the 써봄 backend.
 *
 * Exercises the real HTTP routes against a running dev server:
 *   register → me → create session → submit essay → poll until graded.
 *
 * PREREQUISITES (the moment you have credentials):
 *   1. Copy .env.example → .env.local and fill in, at minimum:
 *        DATABASE_URL        (Supabase POOLED connection, port 6543)
 *        DIRECT_DATABASE_URL (Supabase DIRECT connection, port 5432 — for migrations)
 *        AUTH_SECRET         (any long random string, e.g. `openssl rand -hex 32`)
 *        GEMINI_API_KEY      (Google AI Studio key)
 *      QStash + Supabase Storage are NOT needed for this test:
 *        - no QSTASH_TOKEN  → grading runs in-process (dev fallback)
 *        - text-paste essay → no file storage needed
 *   2. Create the schema + seed plans:
 *        npm run db:push
 *        npm run db:seed
 *   3. Start the dev server in another terminal:
 *        npm run dev
 *   4. Run this test:
 *        npm run smoke
 *
 * Override the target with BASE_URL (defaults to http://localhost:3000).
 * Exits non-zero if any step fails.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- this script inspects arbitrary API JSON */
import "dotenv/config";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

// --- tiny colored logger -------------------------------------------------
const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};
let step = 0;
function pass(msg: string) {
  console.log(`${c.green("  ✓")} ${msg}`);
}
function info(msg: string) {
  console.log(`${c.dim("    " + msg)}`);
}
function heading(msg: string) {
  step += 1;
  console.log(`\n${c.bold(`${step}. ${msg}`)}`);
}
function fail(msg: string, detail?: unknown): never {
  console.error(`\n${c.red("✗ FAILED:")} ${msg}`);
  if (detail !== undefined) console.error(c.dim(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)));
  process.exit(1);
}

// --- cookie-aware fetch --------------------------------------------------
let cookie = "";

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any; raw: Response }> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers["cookie"] = cookie;

  let raw: Response;
  try {
    raw = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    fail(
      `Could not reach ${BASE_URL}${path}. Is the dev server running? (npm run dev)`,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Capture session cookie if the server set one.
  const setCookies = raw.headers.getSetCookie?.() ?? [];
  for (const sc of setCookies) {
    const [pair] = sc.split(";");
    if (pair?.startsWith("ssb_session=")) cookie = pair;
  }

  const text = await raw.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: raw.status, json: parsed, raw };
}

function expect(cond: boolean, msg: string, detail?: unknown) {
  if (!cond) fail(msg, detail);
}

// --- the test ------------------------------------------------------------
async function main() {
  console.log(c.bold(`\n써봄 backend smoke test → ${BASE_URL}`));

  // 1. Health: unauthenticated /me
  heading("Health check (GET /api/auth/me, unauthenticated)");
  {
    const r = await api("GET", "/api/auth/me");
    expect(r.status === 200, `expected 200, got ${r.status}`, r.json);
    expect(r.json?.user === null, "expected { user: null } when not logged in", r.json);
    pass("server reachable, returns null user");
  }

  // 2. Register
  heading("Register a throwaway user (POST /api/auth/register)");
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const creds = {
    username: `smoke_${suffix}`,
    email: `smoke_${suffix}@example.com`,
    password: "smoke-test-1234",
    displayName: "Smoke Test",
  };
  {
    const r = await api("POST", "/api/auth/register", creds);
    expect(r.status === 201, `expected 201, got ${r.status}`, r.json);
    expect(typeof r.json?.user?.id === "string", "expected user.id in response", r.json);
    expect(!("password" in (r.json?.user ?? {})), "password must not be returned", r.json);
    expect(cookie.startsWith("ssb_session="), "expected session cookie to be set", { cookie });
    info(`user id: ${r.json.user.id}  username: ${creds.username}`);
    pass("registered, session cookie set, password stripped");
  }

  // 3. Authenticated /me (with usage)
  heading("Authenticated session (GET /api/auth/me)");
  {
    const r = await api("GET", "/api/auth/me");
    expect(r.status === 200, `expected 200, got ${r.status}`, r.json);
    expect(r.json?.user?.username === creds.username, "expected our user back", r.json);
    expect(r.json?.usage != null, "expected usage info for a registered user", r.json);
    info(`usage: ${JSON.stringify(r.json.usage)}`);
    pass("authenticated, usage info present");
  }

  // 4. Create grading session
  heading("Create a grading session (POST /api/sessions)");
  let sessionId = "";
  {
    const r = await api("POST", "/api/sessions", {
      promptContent:
        "다음 주제로 글을 작성하시오: 인공지능이 교육에 미치는 영향에 대해 자신의 견해를 논하시오.",
      criteriaContent:
        "주장의 명확성(25점), 논리적 근거(25점), 구성과 흐름(25점), 표현과 어휘(25점). 총 100점.",
    });
    expect(r.status === 201, `expected 201, got ${r.status}`, r.json);
    expect(typeof r.json?.session?.id === "string", "expected session.id", r.json);
    sessionId = r.json.session.id;
    info(`session id: ${sessionId}`);
    pass("session created");
  }

  // 5. Submit an essay (text paste → 202, queued)
  heading("Submit an essay (POST /api/sessions/[id]/submissions)");
  let submissionId = "";
  {
    const essay = [
      "인공지능은 교육의 모습을 근본적으로 바꾸고 있다.",
      "첫째, 인공지능 기반 맞춤형 학습은 학생 개개인의 수준에 맞춘 피드백을 제공한다.",
      "이는 기존의 일률적인 수업이 해결하지 못했던 학습 격차 문제를 완화할 수 있다.",
      "둘째, 교사는 채점과 같은 반복 업무에서 벗어나 학생과의 상호작용에 더 집중할 수 있다.",
      "그러나 인공지능에 대한 과도한 의존은 비판적 사고력을 약화시킬 위험도 있다.",
      "따라서 인공지능은 교육을 대체하는 것이 아니라 보조하는 도구로 활용되어야 한다.",
      "결론적으로 인공지능과 인간 교사의 협력이 미래 교육의 핵심이 될 것이다.",
    ].join(" ");

    const r = await api("POST", `/api/sessions/${sessionId}/submissions`, {
      essayContent: essay,
      studentName: "스모크테스트",
    });
    expect(r.status === 202, `expected 202 (queued), got ${r.status}`, r.json);
    expect(typeof r.json?.submission?.id === "string", "expected submission.id", r.json);
    expect(r.json?.submission?.status === "pending", "expected status 'pending'", r.json);
    submissionId = r.json.submission.id;
    info(`submission id: ${submissionId}  status: pending`);
    pass("submission accepted and queued");
  }

  // 6. Poll until graded
  heading("Poll until graded (GET /api/submissions/[id])");
  {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let lastStatus = "";
    let lastProgress = -1;

    while (Date.now() < deadline) {
      const r = await api("GET", `/api/submissions/${submissionId}`);
      expect(r.status === 200, `expected 200 while polling, got ${r.status}`, r.json);
      const sub = r.json?.submission;
      expect(sub != null, "expected submission in poll response", r.json);

      if (sub.status !== lastStatus || sub.progress !== lastProgress) {
        info(`status=${sub.status} progress=${sub.progress}% ${sub.progressMessage ?? ""}`);
        lastStatus = sub.status;
        lastProgress = sub.progress;
      }

      if (sub.status === "completed") {
        const result = r.json.result;
        expect(result != null, "completed but no analysis result returned", r.json);
        expect(typeof result.overallScore === "number", "expected numeric overallScore", result);
        console.log(
          `\n${c.green("  ✓")} graded: ${c.bold(`${result.overallScore} / ${result.maxScore}`)} ` +
            `${c.dim(`(model=${result.model ?? "?"}, tier=${result.tier ?? "?"})`)}`,
        );
        if (Array.isArray(result.strengths) && result.strengths.length) {
          info(`strength sample: ${String(result.strengths[0]).slice(0, 80)}`);
        }
        pass("end-to-end grading succeeded");
        return;
      }

      if (sub.status === "error") {
        fail(
          "grading job ended in 'error' state. Most likely GEMINI_API_KEY is missing/invalid, " +
            "or the model name in GEMINI_MODEL is wrong. Check the dev server logs.",
          sub.progressMessage,
        );
      }

      await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
    }
    fail(
      `grading did not finish within ${POLL_TIMEOUT_MS / 1000}s (last status: ${lastStatus}). ` +
        "Check the dev server logs — the in-process grade job may have thrown.",
    );
  }
}

main()
  .then(() => {
    console.log(`\n${c.green(c.bold("✓ ALL CHECKS PASSED"))}\n`);
    process.exit(0);
  })
  .catch((err) => {
    fail("unexpected error", err instanceof Error ? err.stack : String(err));
  });
