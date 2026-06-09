# 일매출·주간매출 확인 기능 — 설계 (Spec)

- 날짜: 2026-06-09
- 대상: test_repo 매출관리 앱 (Vite + React 19, Supabase MOHA)
- 관련 이전 spec: `2026-05-30-admin-dashboard-and-ux-design.md`

## 1. 목적

관리자와 직원이 **일별 매출**과 **주간(주차별) 매출**을 더 쉽게 확인할 수 있도록 고도화한다.

현재 상태:
- 관리자 대시보드: "이번 달 일별 매출" 막대그래프(`dailySales`), "요일별 패턴"(`byWeekday`)이 이미 존재. 단, 일별은 보기만 가능(드릴다운 없음), 주(週) 단위 묶음 집계는 없음.
- 직원 화면(App): 하단 바에 "이번 달 누적 매출"(현금/카드 분리)만 표시. 오늘/이번 주 매출은 한눈에 볼 수 없음.

## 2. 결정된 요구사항 (브레인스토밍 합의)

- **추가 위치**: 관리자 대시보드 + 직원 화면 **둘 다**
- **한 주의 정의**: **월요일~일요일 (ISO 주)**. 달 경계를 걸치는 주도 자연스럽게 처리.
- **주간매출 범위(관리자)**: **최근 8주 추이** + **이번 달 주차별** 둘 다
- **일별 고도화(관리자)**: **날짜 선택 드릴다운** (막대 클릭 → 그날 상세)

## 3. 접근법

기존 패턴 그대로 확장(A안). 순수 함수는 `analytics.js`에 추가, UI는 의존성 없는 CSS 막대(`BarChartLite`)·비율바 재사용. 새 라이브러리 도입 없음(과거 recharts 흰화면 크래시 교훈 + ISO 주 계산은 수 줄로 가능). date-fns 등 무거운 날짜 라이브러리 도입(C안), 공용 PeriodSummary 컴포넌트 추출(B안)은 YAGNI/충돌 위험으로 기각.

## 4. 데이터 계층 — `src/utils/analytics.js` 추가 순수 함수

레코드 형태: `{ id, type:'현금'|'카드', original, final, name, date(ISO) }`. 집계는 모두 `final` 기준.

- `isoWeekStart(date)` (내부 헬퍼) — 해당 날짜가 속한 주의 **월요일 00:00** `Date` 반환. (getDay(): 0=일 → 월요일까지 거슬러 계산)
- `weeklyTrend(records, weeksBack = 8, now = new Date())`
  → `[{ weekStart(ISO string), label('M/D~M/D'), total, cash, card }]`, 길이 `weeksBack`, 과거→현재 순. now가 속한 주를 마지막으로.
- `weeksInMonth(records, now = new Date())`
  → 이번 정산월(달력월)에 **걸치는** 각 ISO 주: `[{ label('N주차'), rangeStart(ISO), rangeEnd(ISO), total }]`. N주차는 그 달의 첫 주 = 1주차.
- `dayDetail(records, dateISO)`
  → `{ total, count, cash, card, cashPct, cardPct, items[] }`. 해당 **날짜(로컬 자정~다음날 자정)** 레코드만. items는 시간순.
- `todayTotal(records, now = new Date())` → 오늘 `final` 합계 (숫자). 내부적으로 `dayDetail` 재사용 가능.
- `thisWeekTotal(records, now = new Date())` → `{ total, cash, card, rangeStart, rangeEnd }` 이번 주(월~일).

원칙: 모든 함수는 `now`/`dateISO`를 인자로 받아 **결정론적**. 부수효과 없음.

## 5. UI 계층

### 5.1 관리자 대시보드 — `src/components/AdminDashboard.jsx` (+ css)

- **주간매출 섹션** (기존 "이번 달 일별 매출" 근처에 신규 섹션)
  - `최근 8주 추이`: `weeklyTrend` → `BarChartLite` 막대그래프. x축 라벨은 주 시작 'M/D'.
  - `이번 달 주차별`: `weeksInMonth` → 비율바 또는 막대. 각 주 라벨('N주차')과 합계 표기.
- **일별 드릴다운**
  - 기존 "이번 달 일별 매출" 막대를 **클릭 가능**하게 변경(`role="button"`, Enter/Space 키 지원, 포커스 스타일).
  - 선택된 날짜는 `useState(selectedDay)`로 관리. 기본 미선택(접힘). 같은 막대 재클릭/닫기 버튼으로 해제.
  - 선택 시 그래프 아래 펼침 패널에 `dayDetail(salesData, 선택일ISO)` 표시: 그날 합계·건수·현금/카드 금액 및 비율·해당일 거래 리스트.

### 5.2 직원 화면 — `src/App.jsx` (+ App.css)

- 큰 현금/카드 버튼과 하단 "이번 달 누적" 바 **사이**에 요약 카드 한 줄(`.summary-cards`):
  - `오늘 일매출` — `todayTotal` (보조로 현금/카드 작게 optional)
  - `이번 주 주간매출` — `thisWeekTotal.total`, 주 범위 'M/D~M/D' 라벨 동반
- 스타일은 기존 `glass`/`bottom-bar` 톤 재사용. 모바일 좁은 폭에서 줄바꿈 허용.

## 6. 테스트 계층

기존 프로젝트 패턴을 따른다: **임시 node ESM 스크립트(`tmp/*.mjs`) + `npm run build` + `eslint src/`**. (정식 테스트 러너 미설치)

- 테스트 파일: `tmp/weekly_daily_test.mjs` — `src/utils/analytics.js`에서 신규 함수 import, 고정 날짜 픽스처로 assert. 실행: `node tmp/weekly_daily_test.mjs`.
- 케이스:
  - `isoWeekStart`: 일요일/월요일/연말연초 경계가 올바른 월요일을 가리키는지.
  - `weeklyTrend`: 주 경계(월요일 시작), 길이 = weeksBack, 현금/카드 분리 합계.
  - `weeksInMonth`: 달 경계를 걸치는 주의 주차 매핑·합계.
  - `dayDetail`: 특정일만 필터·합계·건수·현금/카드·비율.
  - `todayTotal`/`thisWeekTotal`: `now` 주입 결정론 검증.
- TDD: 각 함수는 실패하는 테스트 먼저 작성 후 구현.

## 7. 검증 & 배포

- `npm run build` → "✓ built"
- `eslint src/` → 0 errors
- (가능 시) Playwright로 관리자 대시보드·직원 화면 실제 렌더 + 콘솔 에러 없음 확인 (과거 recharts 흰화면 교훈).
- 배포는 **사용자 승인 후** `npm run deploy` (gh-pages). 라이브: https://tree0327.github.io/test_repo/

## 8. 범위 밖 (YAGNI)

- 임의 월/기간 선택 UI(이번 라운드는 일별 드릴다운만), 직원 화면 차트, 날짜 라이브러리 도입, 공용 요약 컴포넌트 추출.

## 9. 영향 파일

- `src/utils/analytics.js` (함수 추가)
- `src/components/AdminDashboard.jsx`, `AdminDashboard.css` (주간 섹션 + 일별 드릴다운)
- `src/App.jsx`, `src/App.css` (요약 카드)
- `tmp/weekly_daily_test.mjs` (임시 테스트)
