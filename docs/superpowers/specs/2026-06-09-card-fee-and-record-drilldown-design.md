# 카드 수수료 13.3% + 전체 기록 월→주→일 드릴다운 — 설계 (Spec)

- 날짜: 2026-06-09
- 대상: test_repo 매출관리 앱 (Vite + React 19, Supabase MOHA)
- 관련 이전 spec: `2026-06-09-daily-weekly-sales-design.md`

## 1. 목적

1. **카드 수수료율 변경**: 10% → **13.3%** 차감. 기존 카드 기록도 소급 재계산.
2. **전체 기록 드릴다운**: "전체 매출 기록"(all view)을 월별 → 주간(월~일) → 일별 → 거래 4단계 중첩 아코디언으로 재구성.

## 2. 결정된 요구사항 (브레인스토밍 합의)

- 수수료 13.3% = 카드 final `floor(원금 × 0.867)`.
- **기존 카드 기록 전체 재계산** (Supabase 마이그레이션, 되돌릴 수 없음 — 사용자 승인됨).
- 드릴다운 각 단계마다 현금/카드 필터 유지 + **하향 전파**(부모 필터가 하위에 적용, 자식은 추가로 좁힐 수 있음).
- 주 정의 = ISO 월~일 (`isoWeekStart` 재사용).
- 적용 대상 = "전체 기록"(viewType='all'). "이번 달 상세 기록"(current)은 변경 없음.

## 3. 접근법

기존 RecordModal·analytics 확장(A안). 수수료 상수 일원화, 드릴다운은 기존 아코디언 패턴(openPanels/panelFilters 합성키)을 3단계로 확장. 신규 컴포넌트/라이브러리 없음.

## 4. 카드 수수료 13.3%

### 4.1 계산 (`src/hooks/useSalesData.js`)
- 현재 11번째 줄: `return type === '현금' ? original : Math.floor(original * 0.9);`
- 변경: 상수 `export const CARD_FEE_RATE = 0.133;` 도입, `Math.floor(original * (1 - CARD_FEE_RATE))`.
- 계산 함수를 테스트 가능하도록 export (예: `export function finalAmount(type, original)`).

### 4.2 표시 텍스트 (하드코딩 "10%" → "13.3%")
- `src/components/InputModal.jsx:75`: "수수료 10% 차감 후" → "수수료 13.3% 차감 후".
- `src/components/RecordItem.jsx:22`: "수수료 10% 차감" → "수수료 13.3% 차감".

### 4.3 기존 데이터 마이그레이션 (Supabase, 되돌릴 수 없음)
- 실행 전: `SELECT count(*) FROM sales_records WHERE type = '카드';` (영향 건수 기록).
- 실행: `UPDATE sales_records SET final = floor(original * 0.867) WHERE type = '카드';`
- 검증: 샘플 행에서 `final = floor(original * 0.867)` 확인, count 일치.

## 5. 전체 기록 드릴다운 (월 → 주 → 일 → 기록)

### 5.1 구조 (`src/components/RecordModal.jsx` all view 재구성)
- **Level 1 (월)**: 정산월(YYYY-MM) 그룹. 헤더 = N개월차 · "YYYY년 M월 주기" · 총액 · 현금/카드 소계. (기존 유지)
- **Level 2 (주)**: 그 달 기록을 ISO주(월~일)로 그룹. 헤더 = "N주차 (M/D~M/D)" · 총액 · 현금/카드. 최근 주 우선.
- **Level 3 (일)**: 그 주 기록을 날짜별 그룹. 헤더 = "M/D (요일)" · 총액 · 현금/카드. 최근 일 우선.
- **Leaf**: 그날의 `RecordItem` 리스트 (수정/삭제 유지).

### 5.2 필터 (각 단계 유지 + 하향 전파)
- 각 패널에 `FilterButtons`([전체|현금|카드]).
- 한 노드의 필터는 그 노드 헤더 총액 + 하위 전체에 적용(자식은 부모가 거른 records를 받아 렌더). 자식은 자체 필터로 추가로 좁힐 수 있음.
- 상태 키(합성): 월=`YYYY-MM`, 주=`YYYY-MM|<weekStartISO>`, 일=`YYYY-MM|<weekStartISO>|YYYY-MM-DD`. 기존 `openPanels`/`panelFilters` 패턴 재사용.

### 5.3 집계 헬퍼 (`src/utils/analytics.js`)
- `groupByMonth(records)` → `[{ key:'YYYY-MM', label, total, cash, card, items }]` (최근월 우선).
- `groupByWeek(records)` → `[{ key:weekStartISO, label:'N주차', rangeLabel:'M/D~M/D', total, cash, card, items }]`.
  - N주차 = 해당 records가 속한 달 기준 첫 ISO주를 1주차로. (월 그룹 내부에서 호출되므로 같은 달)
- `groupByDay(records)` → `[{ key:'YYYY-MM-DD', label:'M/D (요일)', total, cash, card, items }]`.
- 각 그룹의 cash/card/total은 그 그룹 items의 `final` 기준. 정렬은 키 내림차순(최근 우선). `isoWeekStart` 재사용.

## 6. 테스트

기존 패턴: 임시 node ESM 스크립트(`tmp/*.mjs`) + `npm run build` + `eslint src/`.

- `tmp/fee_test.mjs`: `finalAmount('카드', 10000) === 8670`(floor(10000×0.867)), `finalAmount('현금', 10000) === 10000`, `finalAmount('카드', 12345) === Math.floor(12345*0.867)`.
- `tmp/grouping_test.mjs`: `groupByMonth/Week/Day` 픽스처 검증 — 키·라벨·rangeLabel·total·cash·card·items 정렬, 달 경계를 걸친 주 처리.
- 마이그레이션 검증: Supabase MCP로 실행 전후 count 및 샘플 행 검증.
- 런타임: `npm run build` ✓ + `eslint src/` 0 + Playwright로 전체기록 모달 월→주→일 펼침·필터·콘솔 에러 0 확인.

## 7. 검증 & 배포

- `npm run build` "✓ built", `eslint src/` 0 errors, 유닛테스트 ALL PASS.
- Playwright 런타임 확인.
- 배포: 사용자 승인 후 `npm run deploy`. 라이브 https://tree0327.github.io/test_repo/.

## 8. 범위 밖 (YAGNI)

- "이번 달 상세 기록"(current view) 변경, 수수료율 사용자 설정 UI, 드릴다운 검색/정렬 옵션.

## 9. 영향 파일

- `src/hooks/useSalesData.js` (수수료 상수·함수)
- `src/components/InputModal.jsx`, `src/components/RecordItem.jsx` (표시 텍스트)
- `src/utils/analytics.js` (groupByMonth/Week/Day)
- `src/components/RecordModal.jsx`, `src/components/RecordModal.css` (중첩 드릴다운)
- Supabase `sales_records` (카드 final 재계산 — 마이그레이션)
- `tmp/fee_test.mjs`, `tmp/grouping_test.mjs` (임시 테스트)
