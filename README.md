# 써봄 (EssayCritiqueAI)

한국어 AI 논술 첨삭·채점 SaaS. Next.js(App Router) + Vercel + Supabase + Gemini.

## 로컬에서 백엔드 검증하기 (자격증명 받은 직후 순서)

핵심 흐름(가입 → 세션 생성 → 답안 제출 → AI 채점)을 끝까지 돌려보는 가장 빠른 경로입니다.
**텍스트 붙여넣기 채점은 QStash·Storage 없이도 동작**합니다(개발 모드에서 채점이 서버 안에서 바로 실행됨).

### 1. 환경변수 채우기

`.env.example`를 복사해 `.env.local`을 만들고, **최소 4개**만 채우면 검증이 됩니다.

```bash
cp .env.example .env.local
```

| 변수 | 무엇 | 어디서 |
| --- | --- | --- |
| `DATABASE_URL` | 앱이 쓰는 풀드 연결 (포트 6543) | Supabase → Project Settings → Database → Connection pooling |
| `DIRECT_DATABASE_URL` | 마이그레이션용 직접 연결 (포트 5432) | 같은 화면의 Direct connection |
| `AUTH_SECRET` | 세션 쿠키 서명용 임의 문자열 | `openssl rand -hex 32` 로 직접 생성 |
| `AI_PROVIDER` + AI 키 | 채점 엔진 선택 + 해당 키 | 아래 "AI 제공자" 참고 |

**AI 제공자 선택** — `AI_PROVIDER` 값에 따라 필요한 키가 달라집니다:
- `AI_PROVIDER=deepseek` → `DEEPSEEK_API_KEY` (DeepSeek, OpenAI 호환). 텍스트 채점은 저렴한 DeepSeek로.
- `AI_PROVIDER=gemini` → `GEMINI_API_KEY` (Google AI Studio). 텍스트·이미지 모두 지원.

**하이브리드 이미지 채점** — DeepSeek는 텍스트 전용이지만, 사진/손글씨 답안(`[IMAGE_DATA:...]`)이
들어오면 자동으로 vision 가능한 제공자(`AI_VISION_PROVIDER`, 기본 `gemini`)로 넘깁니다.
따라서 `AI_PROVIDER=deepseek`로 써도 **이미지 답안 채점을 쓰려면 `GEMINI_API_KEY`가 필요**합니다.
(텍스트 붙여넣기 채점만 쓸 거면 `GEMINI_API_KEY` 없이도 동작합니다.)

> Storage(파일 업로드), QStash(큐), Toss(결제)는 지금 단계에선 비워둬도 됩니다.

설정이 잘 됐는지 한눈에 확인:

```bash
npm run check:env    # 환경변수 점검 (선택한 provider의 키까지 확인)
npm run check:ai     # DB 없이 AI 채점만 단독 검증
```

### 2. DB 스키마 + 기본 플랜 시드

```bash
npm run db:setup     # = drizzle-kit push + 구독 플랜 시드 (한 번에)
```

### 3. 개발 서버 실행 (터미널 1)

```bash
npm run dev
```

### 4. 엔드투엔드 스모크 테스트 (터미널 2)

```bash
npm run smoke
```

가입 → 로그인 확인 → 세션 생성 → 답안 제출 → 채점 완료까지 자동으로 돌려보고
실제 점수(`overallScore / maxScore`)까지 출력하면 백엔드가 정상입니다.
실패하면 어느 단계에서 왜 막혔는지 알려줍니다(예: Gemini 키 누락 → 채점이 `error`).

## 자주 쓰는 명령어

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run typecheck` | 타입 검사 (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm run db:generate` | 스키마 변경 → 마이그레이션 SQL 생성 |
| `npm run db:push` | 스키마를 DB에 직접 반영 |
| `npm run db:seed` | 구독 플랜 시드 |
| `npm run db:studio` | Drizzle Studio (DB 탐색) |
| `npm run check:env` | 환경변수 점검 |
| `npm run check:ai` | AI 채점만 단독 검증 (DB 불필요) |
| `npm run smoke` | 백엔드 엔드투엔드 검증 |

## 아키텍처 메모

- **API**: `app/api/**` Route Handler. DB/파싱/AI를 쓰는 핸들러는 모두 `runtime = "nodejs"`.
- **DB**: Drizzle + postgres.js, Supabase 풀드 연결(`prepare:false`, `max:1`)로 서버리스 커넥션 고갈 방지.
- **비동기 채점**: 제출 → `enqueueGrade` → 워커(`/api/jobs/grade`). QStash 설정 시 durable 재시도, 없으면 개발용 in-process 실행.
- **인증**: 커스텀 JWT(`jose`) HttpOnly 쿠키(`ssb_session`). 비밀번호는 bcrypt, API 키는 sha256 해시만 저장.
- **AI**: `lib/ai/*`에서 provider-agnostic `analyzeEssay`. `AI_PROVIDER`로 Gemini/DeepSeek/Claude 전환. 플랜에 따라 flash/pro 티어링 + pro 실패 시 flash 폴백. **하이브리드**: 텍스트는 base provider(예: DeepSeek), 이미지 답안은 `resolveModel(tier, {hasImages})`가 자동으로 vision provider(`AI_VISION_PROVIDER`, 기본 Gemini)로 라우팅.
