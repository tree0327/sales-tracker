# 1인 통합 앱 + 월말 리포트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1인 사용자가 로그인 하나로 매출 입력과 분석 대시보드를 탭으로 오가고, 매달 초 앱을 열면 지난달 요약 리포트를 자동으로 한 번 보게 하며, 그 과정에서 role 기반 관리자 승격 취약점을 제거한다.

**Architecture:** `Root.jsx`의 role 분기를 제거하고 로그인 후 새 `Shell.jsx`(탭 컨테이너)가 `App`(입력)/`AdminDashboard`(분석)을 전환한다. 월말 리포트는 순수 함수(`analytics.monthlyReport`, `monthlyReport.shouldShowReport`)로 판정·계산하고 `MonthlyReportModal`로 렌더한다. 모든 변경은 순수 React이며 Supabase/외부 서비스 설정이 필요 없다.

**Tech Stack:** React 19, Vite 8, Supabase JS(기존), 신규 vitest(단위 테스트).

## Global Constraints

- 정산월 = 달력월(1일~말일). 기존 `getSalesPeriod`/`ymOf` 관례를 그대로 따른다.
- 시간 의존 로직은 `now`를 인자로 주입한다(기존 analytics 함수 관례와 동일). `Date.now()` 직접 호출 금지.
- 레코드 형태: `{ id, type:'현금'|'카드', original, final, name, date(ISO) }`.
- 카드 최종액/수수료 계산은 기존 `src/utils/fee.js`(수수료율 10%)를 신뢰하고 재계산하지 않는다.
- `localStorage` 접근은 반드시 `try/catch`로 감싼다(기존 `useSalesData` 관례).
- 커밋 시 서명/훅 우회 금지. gpg 서명 미설정 환경이므로 `git -c commit.gpgsign=false commit` 사용.
- 기존 UI 텍스트는 한국어. 신규 UI도 한국어로 작성한다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/Root.jsx` (수정) | 인증 게이트만: 세션 없으면 `Login`, 있으면 `Shell` |
| `src/components/Shell.jsx` (신규) | 탭 상태 관리 + 탭 바 + 로그아웃 + 월말 리포트 트리거 |
| `src/components/Shell.css` (신규) | 탭 바/로그아웃 스타일 |
| `src/App.jsx` (수정) | 입력 화면 내용만(로그아웃 버튼 제거) |
| `src/components/AdminDashboard.jsx` (수정) | 분석 화면 내용만(로그아웃 버튼 제거) |
| `src/utils/analytics.js` (수정) | `monthlyReport(records, monthDate)` 추가 |
| `src/utils/monthlyReport.js` (신규) | `prevPeriodKey`/`shouldShowReport`/`markReportSeen` 표시 판정 |
| `src/utils/monthlyReport.test.js` (신규) | `shouldShowReport`/`prevPeriodKey` 단위 테스트 |
| `src/utils/analytics.monthlyReport.test.js` (신규) | `monthlyReport` 단위 테스트 |
| `src/components/MonthlyReportModal.jsx` (신규) | 리포트 모달 렌더 |
| `src/components/MonthlyReportModal.css` (신규) | 리포트 모달 스타일 |
| `package.json` (수정) | `vitest` devDependency + `test` 스크립트 |

---

## Task 1: vitest 테스트 인프라 도입

**Files:**
- Modify: `package.json`
- Create: `src/utils/smoke.test.js` (임시 스모크 테스트, Task 2에서 삭제)

**Interfaces:**
- Consumes: 없음
- Produces: `npm test` 스크립트(= `vitest run`). 이후 모든 테스트 태스크가 이 명령으로 실행된다.

- [ ] **Step 1: vitest 설치**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm install -D vitest`
Expected: 설치 성공, `package.json` devDependencies에 `vitest` 추가됨.

- [ ] **Step 2: test 스크립트 추가**

`package.json`의 `"scripts"` 블록에 아래 한 줄을 추가한다(기존 `"lint"` 아래):

```json
    "test": "vitest run",
```

- [ ] **Step 3: 스모크 테스트 작성**

Create `src/utils/smoke.test.js`:

```js
import { describe, it, expect } from 'vitest';

describe('vitest 동작 확인', () => {
  it('1 + 1 = 2', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm test`
Expected: PASS (1 passed). vitest가 정상 동작함을 확인.

- [ ] **Step 5: 커밋**

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add package.json package-lock.json src/utils/smoke.test.js
git -c commit.gpgsign=false commit -m "test: vitest 도입 및 test 스크립트 추가"
```

---

## Task 2: `monthlyReport()` 집계 함수 (TDD)

주어진 달의 요약 지표를 한 객체로 반환하는 순수 함수를 `analytics.js`에 추가한다. 기존 모듈-내부 헬퍼(`ymOf`, `ymOfDate`, `sum`)를 재사용한다.

**Files:**
- Create: `src/utils/analytics.monthlyReport.test.js`
- Modify: `src/utils/analytics.js` (파일 끝에 함수 추가)
- Delete: `src/utils/smoke.test.js` (Task 1의 임시 파일)

**Interfaces:**
- Consumes: 없음(모듈 내부 `ymOf`/`sum` 재사용).
- Produces:
  ```
  monthlyReport(records, monthDate) => {
    ym: string,              // "YYYY-MM" (monthDate가 속한 달)
    total: number,           // 그달 총매출(final 합)
    count: number,           // 그달 거래 건수
    avgPerTxn: number,       // 반올림 건당 평균
    momRatePct: number|null, // 전월 대비 %(전월 0이면 null)
    cash: number, card: number,
    cashPct: number, cardPct: number,
    cardFee: number,         // 카드 수수료 총액(original-final 합)
    bestDay: {day:number,total:number}|null,
    top3: Array<record>,     // final 내림차순 상위 3건
  }
  ```
  `records`는 전체 기록, `monthDate`는 대상 달의 임의 날짜(Date).

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/utils/analytics.monthlyReport.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { monthlyReport } from './analytics.js';

// 2026-05 데이터: 현금 10000(5/2), 카드 원금 20000→final 18000(5/2), 현금 5000(5/10)
// 2026-04 데이터(전월): 현금 10000 → 전월 총 10000
const records = [
  { id: 1, type: '현금', original: 10000, final: 10000, name: 'A', date: '2026-05-02T09:00:00.000Z' },
  { id: 2, type: '카드', original: 20000, final: 18000, name: 'B', date: '2026-05-02T11:00:00.000Z' },
  { id: 3, type: '현금', original: 5000, final: 5000, name: 'C', date: '2026-05-10T15:00:00.000Z' },
  { id: 4, type: '현금', original: 10000, final: 10000, name: 'D', date: '2026-04-20T10:00:00.000Z' },
];

describe('monthlyReport', () => {
  const r = monthlyReport(records, new Date(2026, 4, 15)); // 2026-05

  it('대상 달과 총매출/건수/평균', () => {
    expect(r.ym).toBe('2026-05');
    expect(r.total).toBe(33000);   // 10000 + 18000 + 5000
    expect(r.count).toBe(3);
    expect(r.avgPerTxn).toBe(11000); // 33000 / 3
  });

  it('전월 대비 증감(%)', () => {
    // 전월(2026-04) 총 10000 → (33000-10000)/10000 = 230%
    expect(r.momRatePct).toBe(230);
  });

  it('현금/카드 구성과 수수료', () => {
    expect(r.cash).toBe(15000); // 10000 + 5000
    expect(r.card).toBe(18000);
    expect(r.cashPct).toBe(45); // 15000/33000 = 45.45 → 45
    expect(r.cardPct).toBe(55); // 18000/33000 = 54.5 → 55
    expect(r.cardFee).toBe(2000); // 20000 - 18000
  });

  it('최고 매출일과 TOP3', () => {
    expect(r.bestDay).toEqual({ day: 2, total: 28000 }); // 5/2: 10000+18000
    expect(r.top3.map((x) => x.id)).toEqual([2, 1, 3]); // 18000, 10000, 5000
  });

  it('데이터 없는 달은 0/빈값', () => {
    const empty = monthlyReport(records, new Date(2026, 0, 1)); // 2026-01
    expect(empty.total).toBe(0);
    expect(empty.count).toBe(0);
    expect(empty.avgPerTxn).toBe(0);
    expect(empty.momRatePct).toBe(null);
    expect(empty.bestDay).toBe(null);
    expect(empty.top3).toEqual([]);
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npx vitest run src/utils/analytics.monthlyReport.test.js`
Expected: FAIL — `monthlyReport is not a function` (아직 export 없음).

- [ ] **Step 3: `monthlyReport` 구현**

`src/utils/analytics.js` 파일 **맨 끝**에 아래를 추가한다:

```js
// 주어진 달(monthDate가 속한 정산월)의 요약 리포트. 월말 팝업용.
export function monthlyReport(records, monthDate) {
  const ym = ymOfDate(monthDate);
  const prev = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
  const prevYm = ymOfDate(prev);

  const inMonth = records.filter((r) => ymOf(r.date) === ym);
  const inPrev = records.filter((r) => ymOf(r.date) === prevYm);

  const total = sum(inMonth, (r) => r.final);
  const prevTotal = sum(inPrev, (r) => r.final);
  const count = inMonth.length;
  const avgPerTxn = count ? Math.round(total / count) : 0;
  const momRatePct = prevTotal
    ? Math.round(((total - prevTotal) / prevTotal) * 100)
    : null;

  const cash = sum(inMonth.filter((r) => r.type === '현금'), (r) => r.final);
  const card = sum(inMonth.filter((r) => r.type === '카드'), (r) => r.final);
  const denom = cash + card;
  const cashPct = denom ? Math.round((cash / denom) * 100) : 0;
  const cardPct = denom ? Math.round((card / denom) * 100) : 0;

  const cardFee = sum(
    inMonth.filter((r) => r.type === '카드'),
    (r) => (Number(r.original) || 0) - (Number(r.final) || 0)
  );

  const byDay = {};
  for (const r of inMonth) {
    const day = new Date(r.date).getDate();
    byDay[day] = (byDay[day] || 0) + (Number(r.final) || 0);
  }
  const days = Object.entries(byDay).map(([d, t]) => ({ day: Number(d), total: t }));
  const bestDay = days.length ? days.reduce((a, b) => (b.total > a.total ? b : a)) : null;

  const top3 = [...inMonth]
    .sort((a, b) => (Number(b.final) || 0) - (Number(a.final) || 0))
    .slice(0, 3);

  return { ym, total, count, avgPerTxn, momRatePct, cash, card, cashPct, cardPct, cardFee, bestDay, top3 };
}
```

- [ ] **Step 4: 임시 스모크 테스트 삭제**

Delete `src/utils/smoke.test.js` (Task 1에서 만든 임시 파일).

- [ ] **Step 5: 실행해 통과 확인**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm test`
Expected: PASS — `monthlyReport` 5개 테스트 모두 통과, smoke 테스트는 사라짐.

- [ ] **Step 6: 커밋**

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add src/utils/analytics.js src/utils/analytics.monthlyReport.test.js
git rm src/utils/smoke.test.js
git -c commit.gpgsign=false commit -m "feat: monthlyReport 월별 요약 집계 함수 추가"
```

---

## Task 3: 리포트 표시 판정 유틸 (TDD)

"직전 정산월이 마감됐고 그달 리포트를 이 기기에서 아직 안 봤으며 기록이 있으면 표시"를 판정하는 순수 함수. localStorage 키 헬퍼 포함.

**Files:**
- Create: `src/utils/monthlyReport.test.js`
- Create: `src/utils/monthlyReport.js`

**Interfaces:**
- Consumes: 없음.
- Produces:
  ```
  prevPeriodKey(now) => "YYYY-MM"   // now가 속한 달의 직전 달 키
  reportSeenKey(ym) => "report_seen_YYYY-MM"
  shouldShowReport({ now, hasPrevData, isSeen }) => boolean
    // hasPrevData=직전월 기록 존재, isSeen=이미 열람 → 둘 다 아니어야 true
  ```
  `shouldShowReport`는 순수 판정만 하고 localStorage를 직접 만지지 않는다(테스트 용이성).

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/utils/monthlyReport.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { prevPeriodKey, reportSeenKey, shouldShowReport } from './monthlyReport.js';

describe('prevPeriodKey', () => {
  it('직전 달 키를 YYYY-MM으로 반환', () => {
    expect(prevPeriodKey(new Date(2026, 6, 3))).toBe('2026-06'); // 7월 → 6월
  });
  it('1월이면 전년 12월', () => {
    expect(prevPeriodKey(new Date(2026, 0, 1))).toBe('2025-12');
  });
});

describe('reportSeenKey', () => {
  it('열람 키 형식', () => {
    expect(reportSeenKey('2026-06')).toBe('report_seen_2026-06');
  });
});

describe('shouldShowReport', () => {
  const now = new Date(2026, 6, 1);
  it('직전월 기록 있고 미열람 → true', () => {
    expect(shouldShowReport({ now, hasPrevData: true, isSeen: false })).toBe(true);
  });
  it('이미 열람 → false', () => {
    expect(shouldShowReport({ now, hasPrevData: true, isSeen: true })).toBe(false);
  });
  it('직전월 기록 없음 → false', () => {
    expect(shouldShowReport({ now, hasPrevData: false, isSeen: false })).toBe(false);
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npx vitest run src/utils/monthlyReport.test.js`
Expected: FAIL — 모듈/함수 없음.

- [ ] **Step 3: 구현**

Create `src/utils/monthlyReport.js`:

```js
// 월말 리포트 표시 판정 유틸(순수 함수 + localStorage 키 헬퍼).

// now가 속한 달의 직전 달 키 "YYYY-MM".
export function prevPeriodKey(now = new Date()) {
  const p = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`;
}

export function reportSeenKey(ym) {
  return `report_seen_${ym}`;
}

// 직전월에 기록이 있고(hasPrevData) 아직 안 봤으면(!isSeen) 표시.
export function shouldShowReport({ hasPrevData, isSeen }) {
  return Boolean(hasPrevData) && !isSeen;
}

// localStorage 래퍼(실패해도 앱이 죽지 않도록 try/catch).
export function isReportSeen(ym) {
  try {
    return Boolean(window.localStorage.getItem(reportSeenKey(ym)));
  } catch {
    return false;
  }
}

export function markReportSeen(ym) {
  try {
    window.localStorage.setItem(reportSeenKey(ym), '1');
  } catch {
    // 저장 실패는 조용히 무시(다음에 다시 뜰 수 있음).
  }
}
```

- [ ] **Step 4: 실행해 통과 확인**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm test`
Expected: PASS — monthlyReport 판정 테스트 및 기존 테스트 모두 통과.

- [ ] **Step 5: 커밋**

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add src/utils/monthlyReport.js src/utils/monthlyReport.test.js
git -c commit.gpgsign=false commit -m "feat: 월말 리포트 표시 판정 유틸 추가"
```

---

## Task 4: `MonthlyReportModal` 컴포넌트

리포트 데이터를 받아 렌더하는 모달. 기존 모달 오버레이 패턴(`InputModal.css`의 `.modal-overlay` 등)과 일관되게, 단 자체 클래스 네임스페이스를 쓴다.

**Files:**
- Create: `src/components/MonthlyReportModal.jsx`
- Create: `src/components/MonthlyReportModal.css`

**Interfaces:**
- Consumes: `monthlyReport()` 반환 객체(Task 2), `won` 포맷은 내부 정의.
- Produces:
  ```
  <MonthlyReportModal
    report={<monthlyReport 반환 객체>}
    goal={number}            // 월 목표(0이면 목표 섹션 숨김)
    onClose={() => void}
    onGoDashboard={() => void}
  />
  ```
  `report`가 falsy면 아무것도 렌더하지 않는다(null 반환).

- [ ] **Step 1: 컴포넌트 작성**

Create `src/components/MonthlyReportModal.jsx`:

```jsx
import './MonthlyReportModal.css';

const won = (n) => `${(Number(n) || 0).toLocaleString()}원`;

export default function MonthlyReportModal({ report, goal = 0, onClose, onGoDashboard }) {
  if (!report) return null;

  const [y, m] = report.ym.split('-');
  const title = `${y}년 ${Number(m)}월 매출 리포트`;
  const goalPct = goal ? Math.round((report.total / goal) * 100) : null;
  const mom = report.momRatePct;

  return (
    <div className="report-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="report-modal">
        <div className="report-head">
          <h2>{title}</h2>
          <button className="report-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="report-hero">
          <span className="report-hero-label">지난달 총매출</span>
          <strong className="report-hero-value">{won(report.total)}</strong>
          {mom !== null && (
            <span className={`report-mom ${mom > 0 ? 'up' : mom < 0 ? 'down' : ''}`}>
              전월 대비 {mom > 0 ? '▲' : mom < 0 ? '▼' : ''} {Math.abs(mom)}%
            </span>
          )}
        </div>

        <div className="report-grid">
          <div className="report-cell"><span>거래 건수</span><strong>{report.count}건</strong></div>
          <div className="report-cell"><span>건당 평균</span><strong>{won(report.avgPerTxn)}</strong></div>
          <div className="report-cell"><span>현금 {report.cashPct}%</span><strong>{won(report.cash)}</strong></div>
          <div className="report-cell"><span>카드 {report.cardPct}%</span><strong>{won(report.card)}</strong></div>
          <div className="report-cell"><span>카드 수수료</span><strong>{won(report.cardFee)}</strong></div>
          <div className="report-cell">
            <span>최고 매출일</span>
            <strong>{report.bestDay ? `${report.bestDay.day}일 (${won(report.bestDay.total)})` : '—'}</strong>
          </div>
        </div>

        {goalPct !== null && (
          <div className="report-goal">
            <div className="report-goal-row">
              <span>월 목표 달성률</span><strong>{goalPct}%</strong>
            </div>
            <div className="report-progress">
              <div className="report-progress-bar" style={{ width: `${Math.min(goalPct, 100)}%` }} />
            </div>
          </div>
        )}

        <div className="report-top">
          <h3>최고 거래 TOP 3</h3>
          <ul>
            {report.top3.map((r) => (
              <li key={r.id}><span>{r.name || r.type}</span><strong>{won(r.final)}</strong></li>
            ))}
            {report.top3.length === 0 && <li className="muted">거래 없음</li>}
          </ul>
        </div>

        <div className="report-actions">
          <button className="report-btn-secondary" onClick={onClose}>닫기</button>
          <button className="report-btn-primary" onClick={onGoDashboard}>대시보드에서 자세히 보기</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 스타일 작성**

Create `src/components/MonthlyReportModal.css`:

```css
.report-overlay {
  position: fixed; inset: 0; z-index: 200;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.45); padding: 16px;
}
.report-modal {
  width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto;
  background: var(--card-bg, #fff); border-radius: 20px; padding: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  animation: reportPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes reportPop { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.report-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.report-head h2 { font-size: 18px; font-weight: 800; }
.report-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--text-secondary, #888); }
.report-hero { display: flex; flex-direction: column; gap: 4px; padding: 16px; margin-bottom: 14px;
  background: var(--input-bg, #f5f5f7); border-radius: 14px; text-align: center; }
.report-hero-label { font-size: 13px; color: var(--text-secondary, #888); font-weight: 600; }
.report-hero-value { font-size: 28px; font-weight: 800; }
.report-mom { font-size: 13px; font-weight: 700; }
.report-mom.up { color: var(--success, #34c759); }
.report-mom.down { color: var(--danger, #ff3b30); }
.report-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
.report-cell { display: flex; flex-direction: column; gap: 4px; padding: 12px;
  background: var(--input-bg, #f5f5f7); border-radius: 12px; }
.report-cell span { font-size: 12px; color: var(--text-secondary, #888); font-weight: 600; }
.report-cell strong { font-size: 15px; font-weight: 800; }
.report-goal { margin-bottom: 14px; }
.report-goal-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; margin-bottom: 8px; }
.report-progress { height: 10px; background: var(--input-bg, #eee); border-radius: 6px; overflow: hidden; }
.report-progress-bar { height: 100%; background: var(--primary, #007aff); }
.report-top { margin-bottom: 18px; }
.report-top h3 { font-size: 14px; font-weight: 800; margin-bottom: 8px; }
.report-top ul { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.report-top li { display: flex; justify-content: space-between; font-size: 14px; }
.report-top li.muted { color: var(--text-secondary, #aaa); }
.report-actions { display: flex; gap: 10px; }
.report-btn-secondary, .report-btn-primary {
  flex: 1; padding: 14px; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer;
}
.report-btn-secondary { background: var(--input-bg, #eee); color: var(--text-primary, #111); }
.report-btn-primary { background: var(--primary, #007aff); color: #fff; }
```

- [ ] **Step 3: 빌드로 검증**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm run build`
Expected: 빌드 성공(구문/임포트 오류 없음). 컴포넌트는 아직 어디서도 사용되지 않아도 무방.

- [ ] **Step 4: 커밋**

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add src/components/MonthlyReportModal.jsx src/components/MonthlyReportModal.css
git -c commit.gpgsign=false commit -m "feat: 월말 리포트 모달 컴포넌트 추가"
```

---

## Task 5: `Shell` 탭 컨테이너 + 리포트 트리거

로그인 후 두 화면을 탭으로 오가는 컨테이너. 로그아웃 버튼을 여기로 모으고, 마운트 시 월말 리포트 표시를 판정한다. 이 태스크에서 `App`/`AdminDashboard`의 중복 로그아웃 버튼도 함께 제거한다.

**Files:**
- Create: `src/components/Shell.jsx`
- Create: `src/components/Shell.css`
- Modify: `src/App.jsx` (로그아웃 버튼 제거, 사용하지 않게 되는 `supabase` import 정리)
- Modify: `src/components/AdminDashboard.jsx:104-109` (상단 로그아웃 버튼 제거, 사용하지 않게 되는 `supabase` import 정리)

**Interfaces:**
- Consumes: `useSalesData`(salesData, loading), `monthlyReport`(Task 2), `prevPeriodKey`/`isReportSeen`/`markReportSeen`/`shouldShowReport`(Task 3), `MonthlyReportModal`(Task 4), `App`, `AdminDashboard`, `supabase`.
- Produces: `<Shell />` — Root에서 세션 존재 시 렌더되는 최상위 화면.

- [ ] **Step 1: `Shell` 작성**

Create `src/components/Shell.jsx`:

```jsx
import { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useSalesData } from '../hooks/useSalesData';
import { monthlyReport } from '../utils/analytics';
import {
  prevPeriodKey, isReportSeen, markReportSeen, shouldShowReport,
} from '../utils/monthlyReport';
import App from '../App.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import MonthlyReportModal from './MonthlyReportModal.jsx';
import './Shell.css';

const GOAL_KEY = 'admin_monthly_goal';

export default function Shell() {
  const [tab, setTab] = useState('input'); // 'input' | 'dashboard'
  const { salesData, loading } = useSalesData();

  // 직전 정산월 리포트(데이터 로딩 완료 후에만 판정).
  const prevKey = useMemo(() => prevPeriodKey(new Date()), []);
  const report = useMemo(() => {
    if (loading) return null;
    return monthlyReport(salesData, new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  }, [salesData, loading]);

  const seen = isReportSeen(prevKey);
  const show = !loading && report && shouldShowReport({ hasPrevData: report.count > 0, isSeen: seen });
  const [dismissed, setDismissed] = useState(false);

  const closeReport = () => {
    markReportSeen(prevKey);
    setDismissed(true);
  };
  const goDashboardFromReport = () => {
    markReportSeen(prevKey);
    setDismissed(true);
    setTab('dashboard');
  };

  let goal = 0;
  try { goal = Number(window.localStorage.getItem(GOAL_KEY)) || 0; } catch { goal = 0; }

  return (
    <div className="shell">
      <div className="shell-tabs">
        <button
          className={`shell-tab ${tab === 'input' ? 'active' : ''}`}
          onClick={() => setTab('input')}
        >매출 입력</button>
        <button
          className={`shell-tab ${tab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setTab('dashboard')}
        >분석</button>
        <button className="shell-logout" onClick={() => supabase.auth.signOut()}>로그아웃</button>
      </div>

      <div className="shell-body">
        {tab === 'input' ? <App /> : <AdminDashboard />}
      </div>

      {show && !dismissed && (
        <MonthlyReportModal
          report={report}
          goal={goal}
          onClose={closeReport}
          onGoDashboard={goDashboardFromReport}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: `Shell` 스타일 작성**

Create `src/components/Shell.css`:

```css
.shell { display: flex; flex-direction: column; min-height: 100%; }
.shell-tabs {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; position: sticky; top: 0; z-index: 50;
  background: var(--bg-color, #fff); border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.shell-tab {
  padding: 8px 16px; border: none; border-radius: 999px; cursor: pointer;
  font-size: 15px; font-weight: 700; background: var(--input-bg, #f0f0f3);
  color: var(--text-secondary, #666);
}
.shell-tab.active { background: var(--primary, #007aff); color: #fff; }
.shell-logout {
  margin-left: auto; padding: 8px 14px; border: none; border-radius: 999px; cursor: pointer;
  font-size: 14px; font-weight: 600; background: rgba(255, 59, 48, 0.1); color: var(--danger, #ff3b30);
}
.shell-body { flex: 1; }
```

- [ ] **Step 3: `App.jsx`에서 로그아웃 버튼 제거**

`src/App.jsx`에서 아래 블록(107~119번째 줄 부근)을 삭제한다:

```jsx
          <button className="btn-logout" onClick={() => supabase.auth.signOut()}>
            로그아웃
          </button>
```

그리고 파일 상단의 `import { supabase } from './supabaseClient';`(5번째 줄)이 더 이상 쓰이지 않으면 삭제한다. (주의: `handleBackup` 등 다른 곳에서 `supabase`를 직접 쓰지 않는지 확인 — `backupLocalToDb`는 훅 경유이므로 제거 가능.)

- [ ] **Step 4: `AdminDashboard.jsx`에서 로그아웃 버튼 제거**

`src/components/AdminDashboard.jsx`의 상단 바(104~109번째 줄)를 아래처럼 로그아웃 버튼만 제거한다:

```jsx
      <div className="admin-top">
        <h1 className="title">관리자 대시보드</h1>
      </div>
```

그리고 3번째 줄 `import { supabase } from '../supabaseClient';`가 더 이상 쓰이지 않으면 삭제한다.

- [ ] **Step 5: 빌드로 검증**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm run build`
Expected: 빌드 성공. 미사용 import로 인한 오류 없음.

- [ ] **Step 6: 커밋**

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add src/components/Shell.jsx src/components/Shell.css src/App.jsx src/components/AdminDashboard.jsx
git -c commit.gpgsign=false commit -m "feat: Shell 탭 컨테이너 + 로그아웃 통합 + 월말 리포트 트리거"
```

---

## Task 6: `Root.jsx` role 분기 제거 → `Shell` 연결

인증 게이트에서 role 분기를 제거하고 세션이 있으면 `Shell`을 렌더한다. 이로써 관리자 승격 취약점의 메커니즘이 사라진다.

**Files:**
- Modify: `src/Root.jsx`

**Interfaces:**
- Consumes: `useAuth`(session, loading), `Login`, `Shell`(Task 5).
- Produces: 최종 라우팅 — 세션 없으면 `Login`, 있으면 `Shell`.

- [ ] **Step 1: `Root.jsx` 교체**

`src/Root.jsx` 전체를 아래로 교체한다:

```jsx
import Login from './components/Login.jsx'
import Shell from './components/Shell.jsx'
import { useAuth } from './useAuth.js'

// 인증 게이트: 세션 없으면 로그인, 있으면 통합 앱(Shell).
// role 분기는 제거됨 — 1인 사용이므로 로그인한 사용자가 입력/분석 화면을 모두 사용한다.
// (향후 직원 권한 분리가 필요하면 role을 app_metadata에 저장해 재도입할 것.)
export default function Root() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-container">
        <p className="empty">불러오는 중...</p>
      </div>
    )
  }
  if (!session) {
    return <Login />
  }
  return <Shell />
}
```

- [ ] **Step 2: 빌드로 검증**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm run build`
Expected: 빌드 성공. `AdminDashboard` import가 Root에서 사라져도(Shell이 대신 import) 오류 없음.

- [ ] **Step 3: 전체 테스트 + 빌드 회귀 확인**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm test && npm run build`
Expected: 모든 단위 테스트 PASS, 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
cd "C:\Users\dabin\develop\sales-tracker"
git add src/Root.jsx
git -c commit.gpgsign=false commit -m "feat: Root에서 role 분기 제거하고 Shell 연결(승격 취약점 제거)"
```

---

## Task 7: 수동 통합 검증 (dev 서버)

자동 테스트로 못 잡는 화면 전환/모달 노출을 실제 앱에서 확인한다. 이 태스크는 코드 변경이 없고, 문제 발견 시 해당 태스크로 돌아간다.

**Files:** 없음(검증 전용).

**Interfaces:**
- Consumes: 완성된 앱.
- Produces: 동작 확인 결과.

- [ ] **Step 1: 환경변수 확인**

`.env.local`에 `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`가 있는지 확인한다. 없으면 사용자에게 값 입력을 요청한다(로그인·데이터 로딩에 필요).

- [ ] **Step 2: dev 서버 실행**

Run: `cd "C:\Users\dabin\develop\sales-tracker" && npm run dev`
Expected: Vite dev 서버가 로컬 URL(예: http://localhost:5173)에 뜬다.

- [ ] **Step 3: 화면 확인 체크리스트**

브라우저에서 확인(사용자 협조 또는 claude-in-chrome 사용):
- 로그인 → 상단에 `[매출 입력] [분석]` 탭 + 로그아웃 버튼이 보인다.
- `매출 입력` 탭: 현금/카드 입력 UI가 정상 표시된다.
- `분석` 탭: KPI/차트 대시보드가 정상 표시된다.
- 탭 전환이 즉시 동작한다.
- 로그아웃 버튼이 동작한다.
- (리포트) 직전월 기록이 있고 `localStorage`에 `report_seen_<직전월>`이 없으면 앱 로드시 리포트 모달이 뜬다. "닫기" 후 새로고침하면 다시 뜨지 않는다. (테스트하려면 devtools에서 해당 키를 지우고 새로고침.)

- [ ] **Step 4: 문제 없으면 완료 처리**

이상 없으면 이 계획은 완료. 문제가 있으면 해당 Task로 돌아가 수정 후 재검증한다.

---

## Self-Review 결과

- **스펙 커버리지:** (1) 화면 통합 → Task 5·6, (2) role 제거 → Task 6, (3) 월말 리포트 → Task 2·3·4·5, (4) vitest 도입 → Task 1, (5) TDD/빌드 회귀 → 각 Task Step 및 Task 6·7. 누락 없음.
- **플레이스홀더:** 없음(모든 코드 블록 실제 내용 포함).
- **타입 일관성:** `monthlyReport` 반환 필드(`total/count/avgPerTxn/momRatePct/cash/card/cashPct/cardPct/cardFee/bestDay/top3/ym`)를 Task 4 모달과 Task 5 트리거에서 동일하게 사용. `shouldShowReport({ hasPrevData, isSeen })` 시그니처 Task 3·5 일치. `report_seen_<ym>` 키 형식 Task 3·7 일치.
