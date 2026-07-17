# 부부 가계부 (Couple Household Ledger)

부부가 함께 쓰는 가계부 앱입니다. **매달 고정지출부터 빼고 시작**해서, 매출·급여가 들어오면 `+`,
지출하면 `−` 되어 중앙 화면에서 **실시간 잔액**을 봅니다. React + Vite + Supabase, GitHub Pages 배포.

> 이 저장소는 원래 "미용실 매출 관리" 앱이었고, 아내의 미용실 매출 관리(현금/카드 10% 수수료)를
> 그대로 품은 채 부부 가계부로 확장되었습니다.

## 핵심 개념

```
이번 달 잔액 = − 고정지출 + (매출·급여) − 변동지출
```

- 모든 데이터는 부부가 **투명하게 공유**(전부 열람·수정). "누가"는 색 태그(아내·남편·공금)로 구분.
- 로그인한 사람에 따라 입력 시 **소유자가 자동 선택**되고, 직접 탭해야만 바뀝니다.

## 화면 (하단 탭 + 우상단 ⚙ 설정)

- **홈** — 현재 잔액 + 흐름 계산(−고정 / +수입 / −변동 / =잔액) + 대메뉴
- **지출** — `고정 · 아내 · 남편 · 공금` (사람별 카테고리 사용 + 고정지출 관리)
- **＋ 입력** — 커스텀 숫자 키패드(시스템 키보드 미사용), 지출/수입·카테고리·누구·결제수단·날짜·메모
- **매출·급여** — 매출관리(아내·현금/카드+수수료) / 급여관리(남편·금액만)
- **기록** — 월 이동 + 종류·소유자·결제수단 필터 + 월별/일별 보기

## 설치 / 실행

```
npm install
npm run dev
npm run build      # 프로덕션 빌드
npm run deploy     # GitHub Pages 배포
npm test           # 유닛 테스트
```

## Supabase 설정 (필수)

자세한 절차는 [`SETUP_SUPABASE.md`](./SETUP_SUPABASE.md).

1. **SQL 실행**: SQL Editor에서 `supabase/migrations/0006_household_ledger.sql` 실행
   (transactions/fixed_expenses/expense_categories 생성 + 기존 매출 자동 이관)
2. **계정 2개 생성**: Auth → Users 에서 아내·남편 계정 생성
3. **역할 지정**: 각 계정의 user metadata 에 `{ "role": "wife" }` / `{ "role": "husband" }`
   (또는 `src/lib/members.js` 의 `EMAIL_ROLE` 에 이메일→역할 매핑)
4. `.env.local` 에 `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` 설정

## 데이터 모델

- **transactions** — id, flow(income/expense), amount(원금), final(실수령), category, owner(wife/husband/joint), method(카드/현금/계좌), memo, date
- **fixed_expenses** — id, name, amount, day(결제일), method
- **expense_categories** — id, name, sort (설정에서 추가/삭제)

RLS: 로그인(authenticated) 사용자만 전체 접근, 비로그인(anon) 차단.

## 설계 문서

- `docs/superpowers/specs/2026-07-17-couple-household-ledger-design.md`

## 이후 계획 (Phase 2+)

거래 수정/삭제 UI, 월 예산, 분석 그래프, AI 가계부 인사이트, PWA, 자산/공금 잔고, CSV·스크린샷 입력.
