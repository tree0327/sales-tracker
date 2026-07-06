# 매출 관리 (Sales Tracker)

현금/카드 매출을 기록하고 정산월별 누적 매출을 집계·분석하는 React + Vite 앱입니다.
로그인 후 하나의 화면에서 **매출 입력 · 분석 대시보드 · AI 비서**를 탭으로 오갈 수 있습니다.

## 화면 구성 (로그인 후 탭)

- **매출 입력** — 현금/카드 매출 입력
- **분석** — KPI·추이·요일/시간대·현금/카드 비율·고객 집계 등 대시보드 + AI 인사이트
- **AI** — 매출 데이터를 아는 챗봇(일반 대화도 가능)

## 주요 동작

- 현금/카드 매출 입력 (카드는 수수료 **10%** 차감되어 `final`로 집계)
- **입력 시각을 정확히 반영** — 저장 시 실제 현재 시각을 기록하고, 수정 시엔 원래 기록의 시각을 보존
- **정산 기준: 매월 1일 ~ 다음달 1일 (달력상 한 달)**
- "이번 달 누적 매출" 및 "전체 기록"을 정산월(매월 1일 기준)로 그룹·정렬
- 매달 초 접속 시 지난달 요약 리포트 팝업 자동 표시
- 모든 기록은 **Supabase DB**(`sales_records` 테이블)에 저장 (localStorage는 오프라인 캐시)

## AI 기능 (gpt-4o-mini)

OpenAI `gpt-4o-mini`를 **Supabase Edge Function**으로 프록시해 3가지 AI 기능을 제공합니다.
API 키는 서버(Edge Function)에만 보관되며 클라이언트로 노출되지 않습니다.

- **AI 매출 분석** (분석 탭) — 이번 달 지표로 요약·특이점·조언 생성
- **이상치 감지 + 원인 추정** (분석 탭) — 전월 대비 급변/일별 스파이크 감지 후 AI가 원인·조치 제안
- **AI 챗봇** (AI 탭) — 매출 데이터를 근거로 답하고 일반 대화도 지원

> AI 기능은 Edge Function 배포 전에는 "AI 기능을 사용할 수 없습니다" 안내가 표시되며, 앱의 나머지 기능에는 영향이 없습니다.

## 설치 / 실행

```
npm install
npm run dev
```

## Supabase 설정 (필수)

실제 DB 저장을 위해 **테이블 생성 + API 키 입력**이 필요합니다.
자세한 절차는 [`SETUP_SUPABASE.md`](./SETUP_SUPABASE.md) 를 참고하세요.

요약:
1. Supabase SQL Editor에서 `supabase/migrations/0001_create_sales_records.sql` 실행
2. `.env.local` 에 `VITE_SUPABASE_URL` 과 `VITE_SUPABASE_PUBLISHABLE_KEY`(publishable/anon 키) 설정

## AI 기능 설정 (선택 — Supabase 대시보드)

AI 기능을 쓰려면 Edge Function을 배포하고 OpenAI 키를 시크릿으로 등록합니다.

1. **시크릿 등록**: Edge Functions → Secrets → `OPENAI_API_KEY` = OpenAI 키
2. **함수 배포**: Edge Functions에서 이름 **`ai`** 로 함수를 만들고 `supabase/functions/ai/index.ts` 내용을 붙여넣어 Deploy
3. **Verify JWT: ON**(기본값) 유지 → 로그인한 사용자만 호출 가능(키 남용 방지)

> `OPENAI_API_KEY`는 클라이언트용이 아니므로 `VITE_` 접두사를 붙이지 않습니다(브라우저에 노출 금지). 키는 Edge Function 서버에서만 사용됩니다.

## 데이터 모델 (`public.sales_records`)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | text (PK) | 클라이언트 생성 id |
| type | text | '현금' \| '카드' |
| original | numeric | 원금 |
| final | numeric | 최종액(카드는 10% 차감) |
| name | text | 고객명/메모 |
| date | timestamptz | 기록 시각(입력 시각을 정확히 반영) |
| created_at | timestamptz | 생성 시각 |

## 설계/계획 문서

- 설계: `docs/superpowers/specs/2026-05-30-settlement-period-and-supabase-design.md`
- 구현 계획: `docs/superpowers/plans/2026-05-30-settlement-period-and-supabase.md`
- 1인 통합 앱 + 월말 리포트: `docs/superpowers/plans/2026-07-06-single-user-unified-app-and-monthly-report.md`
- AI 고도화: `docs/superpowers/plans/2026-07-06-ai-features.md`
