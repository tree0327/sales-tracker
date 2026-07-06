# 1인 통합 앱 + 월말 리포트 설계

**작성일:** 2026-07-06
**대상 저장소:** sales-tracker

## 배경 / 문제

이 앱은 실제로 **혼자(사장) 다 쓰는 1인 매출앱**이다. 그런데 현재 구조(`src/Root.jsx`)는
로그인 후 `session.user.user_metadata.role` 값으로 **입력 화면(`App`)과 관리자 대시보드
(`AdminDashboard`) 중 하나만** 보여준다.

그 결과:

1. **한 사람이 두 화면을 함께 쓸 수 없다.** 관리자로 로그인하면 매출 입력을 못 하고,
   직원으로 로그인하면 분석 대시보드를 못 본다. 1인 사용 시나리오에 구조가 맞지 않는다.
2. **관리자 권한 승격 취약점.** 역할이 `user_metadata`(= `raw_user_meta_data`)에 저장돼 있는데,
   이 값은 로그인한 본인이 `supabase.auth.updateUser({ data: { role: 'admin' } })` 로 직접
   바꿀 수 있다. 즉 일반 계정이 스스로 관리자 대시보드에 들어올 수 있다.
3. **월말 요약을 볼 방법이 없다.** 지난달이 어땠는지 앱을 열자마자 요약해 주는 기능이 없다.

## 목표

1인 사용자가 **로그인 하나로 매출 입력과 분석을 모두** 하고, **매달 초 앱을 열면 지난달
요약 리포트를 자동으로 한 번** 보게 한다. 동시에 위 권한 취약점을 근본적으로 제거한다.

전부 **순수 React 코드 변경**으로 처리한다. Supabase 스키마 변경, Edge Function, 외부
서비스(이메일/카카오) 설정은 이번 범위에 넣지 않는다.

## 비목표 (YAGNI)

- 직원별 매출 분석 — 1인 사용이라 의미 없음.
- 월 목표 DB 저장 / 실시간(Realtime) 갱신 / 이메일·카카오 자동 전송 — 모두 Supabase·외부
  설정이 필요해 이번 범위 밖. (향후 직원을 두거나 다기기 공유가 필요해지면 별도 스펙으로 진행)

---

## 설계

### 1. 화면 통합 — 탭 기반 단일 앱

로그인 후 두 화면을 탭으로 오가는 **Shell** 컨테이너를 도입한다.

**컴포넌트 경계:**

- `Root.jsx` (수정) — 인증 게이트만 담당. 세션 없으면 `<Login />`, 있으면 `<Shell />`.
  기존의 `role === 'admin'` 분기는 **삭제**한다.
- `Shell.jsx` (신규) — 탭 상태(`'input' | 'dashboard'`)를 관리한다. 상단에 탭 바
  `[매출 입력] [분석]` 과 **로그아웃 버튼**을 두고, 선택된 탭에 따라 `<App />` 또는
  `<AdminDashboard />` 를 렌더한다. 탭 전환 함수를 하위로 내려, 리포트 팝업의
  "대시보드에서 보기" 버튼이 분석 탭으로 이동시킬 수 있게 한다.
- `App.jsx` (수정) — 입력 화면 내용만 담당. 자체 로그아웃 버튼이 있으면 Shell로 이전.
- `AdminDashboard.jsx` (수정) — 분석 화면 내용만 담당. 상단의 로그아웃 버튼(108번째 줄)은
  Shell로 이전(중복 제거).

**데이터 흐름:** 인증 상태는 `useAuth` 그대로. 탭 상태는 `Shell`의 로컬 state.
`useSalesData`는 각 화면에서 기존처럼 사용(변경 없음).

### 2. 역할(role) 개념 제거 → 승격 취약점 제거

- `Root.jsx`에서 role을 읽지 않는다. 로그인한 사용자는 `Shell`을 통해 두 화면 모두 사용한다.
- 이로써 "user_metadata를 고쳐 관리자로 승격"하는 공격 표면이 **사라진다**(패치가 아니라
  메커니즘 제거).
- **유지되는 보호막:** 로그인 게이트(비로그인은 `Login` 화면), RLS 정책(로그인 전용 CRUD,
  마이그레이션 0002/0003), anon 권한 회수(0003). 데이터 접근 범위는 "로그인한 사용자 전체
  공유"로 현행 유지한다.
- 기존 `admin@moha.local` 계정은 그대로 로그인해 통합 앱을 쓰면 된다. metadata의 role 값은
  더 이상 참조되지 않으므로 남아 있어도 무해하다.
- **향후 확장 메모:** 직원을 고용해 권한을 나눠야 할 때는, 역할을 `user_metadata`가 아니라
  **`app_metadata`(사용자가 수정 불가)** 에 저장하고 RLS를 역할 기반으로 강화해 재도입한다.

### 3. 월말 리포트 팝업

**동작 요약:** 앱을 열 때, "직전 정산월"이 마감됐고 그달 리포트를 **이 기기에서 아직 안 봤으면**
`MonthlyReportModal`을 자동으로 1회 띄운다.

**표시 조건(순수 함수로 판정):**

- 정산월은 기존 `getSalesPeriod`(1일~말일) 기준을 따른다. "직전 정산월" = 오늘이 속한
  정산월의 바로 이전 달.
- `localStorage`에 `report_seen_YYYY-MM`(직전월 키)이 없으면 미열람으로 보고 표시한다.
- 표시하거나 사용자가 닫으면 해당 키를 저장해 **같은 달에는 다시 뜨지 않게** 한다.
- 직전월에 매출 기록이 하나도 없으면 띄우지 않는다(빈 리포트 방지).

**리포트 내용(모두 기존 `analytics.js` 재사용/확장):**

- 지난달 총매출 · 거래 건수 · 건당 평균
- 전월 대비 증감(▲▼%)
- 현금/카드 비율 · 카드 수수료 총액
- 최고 매출일 · 최고 거래 TOP 3
- 월 목표가 설정돼 있으면(localStorage `admin_monthly_goal`) 목표 달성률
- 액션 버튼: "대시보드에서 자세히 보기"(분석 탭으로 이동), "닫기"

**컴포넌트/함수:**

- `src/utils/analytics.js` — `monthlyReport(records, monthDate)` 순수 함수 추가.
  주어진 달의 위 지표를 한 객체로 반환. 기존 `kpiSummary`/`cashCardRatio`/`cardFeeTotal`/
  `topTransactions` 로직을 재사용/조합.
- `src/utils/monthlyReport.js` (신규, 선택적 분리) — 표시 조건 판정
  `shouldShowReport(now, seenKeys)` 와 seen 키 헬퍼. 순수 함수로 테스트 가능하게 분리.
- `src/components/MonthlyReportModal.jsx` (신규) — 위 데이터를 받아 렌더. 기존
  `InputModal`/`RecordModal`의 모달 스타일과 일관되게.
- `Shell.jsx`에서 마운트 시 표시 조건을 확인해 모달을 띄우고, "대시보드에서 보기"는 분석 탭
  전환과 연결한다.

### 4. 에러 처리

- `localStorage` 접근은 기존 코드(`useSalesData`)처럼 `try/catch`로 감싸 실패해도 앱이 죽지
  않게 한다(리포트를 못 띄우면 조용히 건너뜀).
- 데이터 로딩 중(`useSalesData.loading`)에는 리포트 판정을 미뤄 빈 데이터로 오판하지 않는다.

### 5. 테스트

**현황:** 이 저장소에는 테스트 러너가 설치돼 있지 않다(vitest/jest 없음, `test` 스크립트
없음, 기존 테스트 파일 없음). 따라서 테스트 인프라부터 갖춘다.

- **테스트 러너 도입:** `vitest`를 devDependency로 추가하고 `package.json`에
  `"test": "vitest run"` 스크립트를 넣는다. 외부 서비스 불필요(로컬 npm 설치).
- **TDD:** `monthlyReport()`와 `shouldShowReport()`는 구현 전에 단위 테스트를 먼저 작성한다.
  - `monthlyReport`: 현금/카드 혼합 샘플로 총매출·건수·평균·전월대비·수수료·최고일·TOP3 검증.
  - `shouldShowReport`: (a) 직전월 미열람→true, (b) 이미 열람→false, (c) 직전월 기록
    없음→false, (d) seen 키 저장 후 재판정→false.
- **날짜 고정:** 시간에 의존하는 판정은 `now`를 인자로 주입해(현재 코드 관례와 동일) 고정
  날짜로 테스트한다.
- 회귀: `npm run build` 통과, `npm test` 통과.

UI 컴포넌트(`Shell`, `MonthlyReportModal`)는 렌더링 테스트 라이브러리를 새로 들이지 않고,
로직을 순수 함수로 뽑아 그 함수만 단위 테스트한다(컴포넌트는 빌드 통과로 검증).

---

## 영향 받는 파일 요약

| 파일 | 변경 |
|---|---|
| `src/Root.jsx` | role 분기 삭제, `Shell` 렌더 |
| `src/components/Shell.jsx` | 신규 — 탭 컨테이너 + 로그아웃 + 리포트 팝업 트리거 |
| `src/App.jsx` | 로그아웃 버튼 Shell로 이전(있으면) |
| `src/components/AdminDashboard.jsx` | 로그아웃 버튼 Shell로 이전 |
| `src/utils/analytics.js` | `monthlyReport()` 추가 |
| `src/utils/monthlyReport.js` | 신규 — 표시 조건 판정 |
| `src/components/MonthlyReportModal.jsx` (+ css) | 신규 — 리포트 모달 |
| `package.json` | `vitest` devDependency + `test` 스크립트 추가 |
| 테스트 파일 | `monthlyReport`/`shouldShowReport` 단위 테스트 |
