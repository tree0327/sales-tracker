# 매출 관리 (Sales Tracker)

현금/카드 매출을 기록하고 정산월별 누적 매출을 집계하는 React + Vite 앱입니다.

## 주요 동작

- 현금/카드 매출 입력 (카드는 수수료 10% 차감되어 `final`로 집계)
- **정산 기준: 매월 1일 ~ 다음달 1일 (달력상 한 달)**
- "이번 달 누적 매출" 및 "전체 기록"을 정산월(매월 1일 기준)로 그룹·정렬
- 모든 기록은 **Supabase DB**(`sales_records` 테이블)에 저장 (localStorage는 오프라인 캐시)

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

## 데이터 모델 (`public.sales_records`)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | text (PK) | 클라이언트 생성 id |
| type | text | '현금' \| '카드' |
| original | numeric | 원금 |
| final | numeric | 최종액(카드는 10% 차감) |
| name | text | 고객명/메모 |
| date | timestamptz | 기록 시각 |
| created_at | timestamptz | 생성 시각 |

## 설계/계획 문서

- 설계: `docs/superpowers/specs/2026-05-30-settlement-period-and-supabase-design.md`
- 구현 계획: `docs/superpowers/plans/2026-05-30-settlement-period-and-supabase.md`
