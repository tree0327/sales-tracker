# 일매출·주간매출 확인 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 대시보드에 주간(주차별) 매출 섹션과 일별 드릴다운을, 직원 화면에 오늘/이번 주 요약 카드를 추가한다.

**Architecture:** 순수 집계 함수를 `src/utils/analytics.js`에 추가(결정론적, `now`/`dateISO` 주입)하고, 의존성 없는 기존 `BarChartLite`·비율바·`compare-row` 스타일을 재사용해 UI를 구성한다. ISO 주(월~일)는 직접 계산하며 새 라이브러리는 도입하지 않는다.

**Tech Stack:** Vite, React 19, @supabase/supabase-js. 테스트는 임시 node ESM 스크립트(`tmp/*.mjs`) + `npm run build` + `eslint src/`.

**Reference spec:** `docs/superpowers/specs/2026-06-09-daily-weekly-sales-design.md`

---

## File Structure

- `src/utils/analytics.js` — 신규 순수 함수 6종 추가(`isoWeekStart` 내부 헬퍼, `weeklyTrend`, `weeksInMonth`, `dayDetail`, `todayTotal`, `thisWeekTotal`). 기존 `sum` 헬퍼 재사용.
- `src/components/AdminDashboard.jsx` — 주간매출 섹션 + 일별 막대 클릭 드릴다운.
- `src/components/AdminDashboard.css` — 드릴다운 패널·클릭 막대 스타일.
- `src/App.jsx` — 직원 요약 카드 한 줄.
- `src/App.css` — `.summary-cards` 스타일.
- `tmp/weekly_daily_test.mjs` — 임시 유닛테스트(커밋하지 않음, .gitignore의 tmp).

> 참고: 2026년 6월은 1일이 월요일이라 ISO주(월~일)가 달력주와 정렬됨 — 테스트 픽스처가 이를 활용.

---

## Task 1: analytics.js 집계 함수 추가 (TDD)

**Files:**
- Test: `tmp/weekly_daily_test.mjs` (create)
- Modify: `src/utils/analytics.js` (기존 `sum` 헬퍼 아래, `filterByRange` 부근에 추가)

- [ ] **Step 1: 실패 테스트 작성** — `tmp/weekly_daily_test.mjs`

```js
import assert from 'node:assert';
import {
  isoWeekStart, weeklyTrend, weeksInMonth, dayDetail, todayTotal, thisWeekTotal,
} from '../src/utils/analytics.js';

// 2026-06 은 1일이 월요일 → ISO주(월~일)가 달력주와 정렬
const now = new Date(2026, 5, 9, 12, 0); // Tue Jun 9 2026 (local)
const D = (m, d, h = 12) => new Date(2026, m - 1, d, h, 0).toISOString();

const records = [
  // 1주차 (Jun 1~7)
  { id: 'a', type: '현금', original: 7000, final: 7000, name: '', date: D(6, 3) },
  // 2주차 (Jun 8~14) — 이번 주
  { id: 'b', type: '현금', original: 10000, final: 10000, name: '', date: D(6, 8) },     // Mon
  { id: 'c', type: '카드', original: 10000, final: 9000, name: '', date: D(6, 9, 9) },   // Tue 오전 (오늘)
  { id: 'd', type: '현금', original: 5000, final: 5000, name: '', date: D(6, 9, 15) },   // Tue 오후 (오늘)
  { id: 'e', type: '카드', original: 20000, final: 18000, name: '', date: D(6, 9, 18) }, // Tue 저녁 (오늘)
];

// isoWeekStart: now 가 속한 주의 월요일(6/8)
const ws = isoWeekStart(now);
assert.strictEqual(ws.getDate(), 8, 'isoWeekStart day');
assert.strictEqual(ws.getMonth(), 5, 'isoWeekStart month=June');
assert.strictEqual(ws.getDay(), 1, 'isoWeekStart is Monday');
// 일요일도 그 주의 월요일을 가리켜야 함: 6/14(일) → 6/8(월)
assert.strictEqual(isoWeekStart(new Date(2026, 5, 14, 12)).getDate(), 8, 'Sunday maps to its Monday');

// weeklyTrend: 길이=8, 마지막 = 이번 주
const wt = weeklyTrend(records, 8, now);
assert.strictEqual(wt.length, 8, 'weeklyTrend length');
const lastWeek = wt[wt.length - 1];
assert.strictEqual(lastWeek.total, 42000, 'this week total');   // 10000+9000+5000+18000
assert.strictEqual(lastWeek.cash, 15000, 'this week cash');     // 10000+5000
assert.strictEqual(lastWeek.card, 27000, 'this week card');     // 9000+18000
const prevWeek = wt[wt.length - 2];
assert.strictEqual(prevWeek.total, 7000, 'last week total');    // 6/3

// weeksInMonth: 6월은 5주(1~7,8~14,15~21,22~28,29~7/5)
const wim = weeksInMonth(records, now);
assert.strictEqual(wim.length, 5, 'weeksInMonth length');
assert.strictEqual(wim[0].label, '1주차', 'first week label');
assert.strictEqual(wim[0].total, 7000, '1주차 total');
assert.strictEqual(wim[1].label, '2주차', 'second week label');
assert.strictEqual(wim[1].total, 42000, '2주차 total');

// dayDetail: 오늘(6/9) 거래 3건
const dd = dayDetail(records, now);
assert.strictEqual(dd.total, 23000, 'today total');  // 9000+5000+18000
assert.strictEqual(dd.count, 3, 'today count');
assert.strictEqual(dd.cash, 5000, 'today cash');
assert.strictEqual(dd.card, 27000, 'today card');
assert.strictEqual(dd.cashPct, 22, 'today cashPct');  // 5000/23000=21.7→22
assert.strictEqual(dd.cardPct, 78, 'today cardPct');
assert.strictEqual(dd.items.length, 3, 'today items');
assert.strictEqual(dd.items[0].id, 'c', 'items sorted by time'); // 09시 먼저

// todayTotal / thisWeekTotal
assert.strictEqual(todayTotal(records, now), 23000, 'todayTotal');
const twt = thisWeekTotal(records, now);
assert.strictEqual(twt.total, 42000, 'thisWeekTotal.total');
assert.strictEqual(twt.cash, 15000, 'thisWeekTotal.cash');
assert.strictEqual(twt.card, 27000, 'thisWeekTotal.card');
assert.ok(/6\/8~6\/14/.test(twt.rangeLabel), 'thisWeekTotal.rangeLabel');

console.log('ALL PASS');
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd "C:\Users\User\OneDrive\문서\test_repo" && node tmp/weekly_daily_test.mjs`
Expected: FAIL — `isoWeekStart`/`weeklyTrend` 등 export 없음 (`SyntaxError: ... does not provide an export named 'isoWeekStart'`).

- [ ] **Step 3: 함수 구현** — `src/utils/analytics.js` 의 `filterByRange` 함수 바로 아래(16번째 줄 이후)에 추가

```js
// ISO 주: 월요일 시작. 주어진 날짜가 속한 주의 월요일 00:00(로컬) Date 반환.
export function isoWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=일 .. 6=토
  const diff = day === 0 ? -6 : 1 - day; // 월요일까지 이동
  d.setDate(d.getDate() + diff);
  return d;
}

const fmtMD = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

// [start, end) 구간 합계 계산 헬퍼
function bucketTotals(records, start, end) {
  const inRange = records.filter((r) => {
    const t = new Date(r.date).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
  return {
    items: inRange,
    total: sum(inRange, (r) => r.final),
    cash: sum(inRange.filter((r) => r.type === '현금'), (r) => r.final),
    card: sum(inRange.filter((r) => r.type === '카드'), (r) => r.final),
  };
}

// 최근 weeksBack 주(월~일)의 주별 매출. 과거→현재 순, 마지막이 now가 속한 주.
export function weeklyTrend(records, weeksBack = 8, now = new Date()) {
  const thisWeekStart = isoWeekStart(now);
  const out = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const start = new Date(thisWeekStart);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7); // 미포함 경계
    const endLabel = new Date(start);
    endLabel.setDate(endLabel.getDate() + 6);
    const b = bucketTotals(records, start, end);
    out.push({
      weekStart: start.toISOString(),
      label: `${fmtMD(start)}~${fmtMD(endLabel)}`,
      total: b.total,
      cash: b.cash,
      card: b.card,
    });
  }
  return out;
}

// 이번 정산월(달력월)에 걸치는 각 ISO주(월~일). 첫 주 = 1주차.
export function weeksInMonth(records, now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1); // 미포함
  let weekStart = isoWeekStart(monthStart);
  const out = [];
  let n = 1;
  while (weekStart.getTime() < monthEnd.getTime()) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const endLabel = new Date(weekStart);
    endLabel.setDate(endLabel.getDate() + 6);
    const b = bucketTotals(records, weekStart, weekEnd);
    out.push({
      label: `${n}주차`,
      rangeStart: weekStart.toISOString(),
      rangeEnd: weekEnd.toISOString(),
      rangeLabel: `${fmtMD(weekStart)}~${fmtMD(endLabel)}`,
      total: b.total,
    });
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + 7);
    n++;
  }
  return out;
}

// 특정 날짜(로컬 자정~다음날 자정)의 상세. dateISO 는 ISO 문자열 또는 Date.
export function dayDetail(records, dateISO) {
  const d = new Date(dateISO);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  const b = bucketTotals(records, start, end);
  const items = [...b.items].sort((a, z) => new Date(a.date) - new Date(z.date));
  const total = b.total;
  return {
    total,
    count: items.length,
    cash: b.cash,
    card: b.card,
    cashPct: total ? Math.round((b.cash / total) * 100) : 0,
    cardPct: total ? Math.round((b.card / total) * 100) : 0,
    items,
  };
}

// 오늘 총 매출(숫자).
export function todayTotal(records, now = new Date()) {
  return dayDetail(records, now).total;
}

// 이번 주(월~일) 매출 요약.
export function thisWeekTotal(records, now = new Date()) {
  const start = isoWeekStart(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const endLabel = new Date(start);
  endLabel.setDate(endLabel.getDate() + 6);
  const b = bucketTotals(records, start, end);
  return {
    total: b.total,
    cash: b.cash,
    card: b.card,
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
    rangeLabel: `${fmtMD(start)}~${fmtMD(endLabel)}`,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd "C:\Users\User\OneDrive\문서\test_repo" && node tmp/weekly_daily_test.mjs`
Expected: `ALL PASS`

- [ ] **Step 5: lint 확인**

Run: `cd "C:\Users\User\OneDrive\문서\test_repo" && npx eslint src/utils/analytics.js`
Expected: 출력 없음(0 errors).

- [ ] **Step 6: 커밋**

```bash
cd "C:\Users\User\OneDrive\문서\test_repo" && git add src/utils/analytics.js && git commit -m "feat: 주간/일별 매출 집계 순수 함수 추가 (weeklyTrend, weeksInMonth, dayDetail, todayTotal, thisWeekTotal)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 관리자 대시보드 — 주간 섹션 + 일별 드릴다운

**Files:**
- Modify: `src/components/AdminDashboard.jsx`
- Modify: `src/components/AdminDashboard.css`

- [ ] **Step 1: import에 신규 함수 추가** — `src/components/AdminDashboard.jsx:4-8` 의 import 블록 교체

```jsx
import {
  kpiSummary, monthlyTrend, dailySales, byWeekday, byHour, samePeriodCompare,
  cashCardRatio, cardFeeTotal, originalVsFinal, topTransactions, byCustomer,
  forecast, toCSV, filterByRange,
  weeklyTrend, weeksInMonth, dayDetail,
} from '../utils/analytics';
```

- [ ] **Step 2: useMemo·상태 추가** — `src/components/AdminDashboard.jsx:54`(`const projected = ...` 줄) 바로 아래에 추가

```jsx
  const weekly = useMemo(() => weeklyTrend(salesData, 8, now), [salesData, now]);
  const monthWeeks = useMemo(() => weeksInMonth(salesData, now), [salesData, now]);
  const [selectedDay, setSelectedDay] = useState(null); // 1~말일 또는 null
  const dayInfo = useMemo(
    () => (selectedDay ? dayDetail(salesData, new Date(now.getFullYear(), now.getMonth(), selectedDay)) : null),
    [salesData, now, selectedDay]
  );
```

- [ ] **Step 3: 차트 변환 데이터 추가** — `src/components/AdminDashboard.jsx` 의 `const ratioTotal = ...`(92번째 줄 부근) 바로 위에 추가

```jsx
  const weeklyData = weekly.map((w) => ({ label: w.label.split('~')[0], value: w.total }));
  const monthWeeksMax = Math.max(1, ...monthWeeks.map((w) => w.total));
```

- [ ] **Step 4: 일별 막대를 클릭 가능하게 + 드릴다운 패널** — `src/components/AdminDashboard.jsx` 의 "이번 달 일별 매출" 섹션(133-136번째 줄) 전체를 교체

```jsx
      <div className="admin-section">
        <h2>이번 달 일별 매출</h2>
        <div className="barchart">
          {dailyData.map((d) => {
            const max = Math.max(1, ...dailyData.map((x) => x.value));
            const day = Number(d.label);
            const isSel = selectedDay === day;
            return (
              <div className="barchart-col" key={d.label}>
                <div
                  className={`barchart-track clickable${isSel ? ' selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  title={`${d.label}일: ${d.value.toLocaleString()}원`}
                  onClick={() => setSelectedDay(isSel ? null : day)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedDay(isSel ? null : day);
                    }
                  }}
                >
                  <div
                    className="barchart-bar"
                    style={{ height: `${(d.value / max) * 100}%`, background: isSel ? '#ff9500' : '#34c759' }}
                  />
                </div>
                <span className="barchart-label">{d.label}</span>
              </div>
            );
          })}
        </div>
        {dayInfo && (
          <div className="day-detail">
            <div className="day-detail-head">
              <strong>{now.getMonth() + 1}월 {selectedDay}일</strong>
              <button className="day-detail-close" onClick={() => setSelectedDay(null)} aria-label="닫기">✕</button>
            </div>
            <div className="compare-row">
              <div><span>합계</span><strong>{won(dayInfo.total)}</strong></div>
              <div><span>건수</span><strong>{dayInfo.count}건</strong></div>
              <div><span>현금 {dayInfo.cashPct}%</span><strong>{won(dayInfo.cash)}</strong></div>
              <div><span>카드 {dayInfo.cardPct}%</span><strong>{won(dayInfo.card)}</strong></div>
            </div>
            <ul className="rank-list day-detail-list">
              {dayInfo.items.map((r) => (
                <li key={r.id}>
                  <span>{new Date(r.date).toTimeString().slice(0, 5)} · {r.type}{r.name ? ` · ${r.name}` : ''}</span>
                  <strong>{won(r.final)}</strong>
                </li>
              ))}
              {dayInfo.count === 0 && <li className="muted">거래 없음</li>}
            </ul>
          </div>
        )}
      </div>
```

- [ ] **Step 5: 주간매출 섹션 추가** — Step 4에서 교체한 "이번 달 일별 매출" 섹션 `</div>` 바로 다음에 삽입

```jsx
      <div className="admin-section">
        <h2>최근 8주 매출 추이</h2>
        <BarChartLite data={weeklyData} color="#5ac8fa" />
      </div>

      <div className="admin-section">
        <h2>이번 달 주차별 매출</h2>
        <ul className="rank-list">
          {monthWeeks.map((w) => (
            <li key={w.label} className="week-row">
              <span className="week-label">{w.label} <em>{w.rangeLabel}</em></span>
              <div className="week-bar-wrap">
                <div className="week-bar" style={{ width: `${(w.total / monthWeeksMax) * 100}%` }} />
              </div>
              <strong>{won(w.total)}</strong>
            </li>
          ))}
        </ul>
      </div>
```

- [ ] **Step 6: CSS 추가** — `src/components/AdminDashboard.css` 맨 끝에 추가

```css
/* 일별 드릴다운 */
.barchart-track.clickable { cursor: pointer; outline: none; }
.barchart-track.clickable:focus-visible { box-shadow: 0 0 0 2px var(--primary); border-radius: 4px; }
.barchart-track.selected .barchart-bar { box-shadow: 0 0 0 2px #ff9500; }
.day-detail {
  margin-top: 14px;
  padding: 14px;
  border-radius: 12px;
  background: var(--input-bg);
}
.day-detail-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.day-detail-head strong { font-size: 15px; font-weight: 800; }
.day-detail-close { border: none; background: transparent; font-size: 16px; cursor: pointer; color: var(--text-secondary); }
.day-detail-list { margin-top: 12px; }

/* 주차별 매출 행 */
.week-row { align-items: center; gap: 10px; }
.week-label { flex: 0 0 auto; min-width: 92px; font-weight: 700; }
.week-label em { font-style: normal; font-weight: 500; color: var(--text-secondary); font-size: 11px; }
.week-bar-wrap { flex: 1; height: 10px; background: var(--input-bg); border-radius: 6px; overflow: hidden; }
.week-bar { height: 100%; background: var(--primary); border-radius: 6px; transition: width 0.3s; }
```

- [ ] **Step 7: 빌드 + lint 확인**

Run: `cd "C:\Users\User\OneDrive\문서\test_repo" && npm run build && npx eslint src/components/AdminDashboard.jsx`
Expected: `✓ built`, eslint 출력 없음.

- [ ] **Step 8: 커밋**

```bash
cd "C:\Users\User\OneDrive\문서\test_repo" && git add src/components/AdminDashboard.jsx src/components/AdminDashboard.css && git commit -m "feat: 관리자 대시보드에 주간매출 섹션 + 일별 드릴다운 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 직원 화면 — 오늘/이번 주 요약 카드

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: import 추가** — `src/App.jsx:3`(`import { getSalesPeriod, ... }` 줄) 바로 아래에 추가

```jsx
import { todayTotal, thisWeekTotal } from './utils/analytics';
```

- [ ] **Step 2: 요약 값 계산** — `src/App.jsx` 의 `const currentCardTotal = ...`(57번째 줄) 바로 아래에 추가

```jsx
  const now = new Date();
  const todaySales = todayTotal(salesData, now);
  const weekSales = thisWeekTotal(salesData, now);
```

- [ ] **Step 3: 요약 카드 마크업 삽입** — `src/App.jsx` 의 `</div>`(`main-buttons` 닫는 줄, 138번째 줄) 바로 다음에 삽입

```jsx
      <div className="summary-cards">
        <div className="summary-card glass">
          <span className="summary-label">오늘 일매출</span>
          <span className="summary-value">{todaySales.toLocaleString()}<em>원</em></span>
        </div>
        <div className="summary-card glass">
          <span className="summary-label">이번 주 매출 <em>{weekSales.rangeLabel}</em></span>
          <span className="summary-value">{weekSales.total.toLocaleString()}<em>원</em></span>
        </div>
      </div>
```

- [ ] **Step 4: CSS 추가** — `src/App.css` 맨 끝에 추가

```css
/* 직원 요약 카드 (오늘/이번 주) */
.summary-cards {
  display: flex;
  gap: 12px;
  margin: 16px 0;
  flex-wrap: wrap;
}
.summary-card {
  flex: 1 1 140px;
  padding: 16px;
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  text-align: center;
}
.summary-label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 700;
  margin-bottom: 6px;
}
.summary-label em { font-style: normal; font-weight: 500; font-size: 11px; }
.summary-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
}
.summary-value em { font-style: normal; font-size: 14px; font-weight: 700; margin-left: 2px; }
```

- [ ] **Step 5: 빌드 + lint 확인**

Run: `cd "C:\Users\User\OneDrive\문서\test_repo" && npm run build && npx eslint src/App.jsx`
Expected: `✓ built`, eslint 출력 없음.

- [ ] **Step 6: 커밋**

```bash
cd "C:\Users\User\OneDrive\문서\test_repo" && git add src/App.jsx src/App.css && git commit -m "feat: 직원 화면에 오늘 일매출/이번 주 매출 요약 카드 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 최종 검증 + 배포

**Files:** 없음(검증만)

- [ ] **Step 1: 전체 lint**

Run: `cd "C:\Users\User\OneDrive\문서\test_repo" && npx eslint src/`
Expected: 출력 없음(0 errors).

- [ ] **Step 2: 유닛테스트 재실행**

Run: `cd "C:\Users\User\OneDrive\문서\test_repo" && node tmp/weekly_daily_test.mjs`
Expected: `ALL PASS`

- [ ] **Step 3: 프로덕션 빌드**

Run: `cd "C:\Users\User\OneDrive\문서\test_repo" && npm run build`
Expected: `✓ built`.

- [ ] **Step 4: (가능 시) 런타임 렌더 확인** — Playwright로 `npm run preview` 또는 dist 서빙 후 직원/관리자 화면 콘솔 에러 없음 확인. 샌드박스 네트워크 차단 시 생략하고 사용자에게 브라우저 확인 요청.

- [ ] **Step 5: 배포 (사용자 승인 후)**

Run: `cd "C:\Users\User\OneDrive\문서\test_repo" && npm run deploy`
Expected: gh-pages 푸시 성공. 라이브 https://tree0327.github.io/test_repo/ HTTP 200.

---

## Self-Review (작성자 체크)

- **Spec 커버리지:** 데이터 6함수(T1) / 관리자 주간 8주·주차별·일별 드릴다운(T2) / 직원 오늘·이번주 카드(T3) / 검증·배포(T4) — spec 4·5·6·7장 전 항목 매핑. ✓
- **Placeholder:** 모든 코드 스텝에 실제 코드 포함, TBD 없음. ✓
- **타입 일관성:** `weeklyTrend`→`{weekStart,label,total,cash,card}`, `weeksInMonth`→`{label,rangeLabel,total,...}`, `dayDetail`→`{total,count,cash,card,cashPct,cardPct,items}`, `thisWeekTotal`→`{total,cash,card,rangeLabel,...}`. UI에서 사용하는 필드명과 정의 일치. ✓
- **주의:** `weeksInMonth`의 각 주 합계는 ISO주 전체(월~일) 기준이므로 달 경계를 걸친 주는 인접월 일부 매출을 포함할 수 있음 — 의도된 동작(spec 4장). `tmp/`는 .gitignore라 테스트 파일은 커밋되지 않음.
