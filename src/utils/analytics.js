// 매출 집계 순수 함수 모음. 정산월 = 달력월(1일~말일).
// 레코드: { id, type:'현금'|'카드', original, final, name, date(ISO) }

const ymOf = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const ymOfDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);

export function filterByRange(records, start, end) {
  return records.filter((r) => {
    const t = new Date(r.date).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
}

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

const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'];

function groupTotals(items) {
  return {
    total: sum(items, (r) => r.final),
    cash: sum(items.filter((r) => r.type === '현금'), (r) => r.final),
    card: sum(items.filter((r) => r.type === '카드'), (r) => r.final),
  };
}

const byDateDesc = (a, b) => new Date(b.date) - new Date(a.date);
const keyDesc = (a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0);

// 정산월(YYYY-MM) 그룹. 최근월 우선.
export function groupByMonth(records) {
  const map = new Map();
  for (const r of records) {
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return [...map.entries()].sort(keyDesc).map(([key, items]) => {
    const [y, m] = key.split('-');
    const sorted = [...items].sort(byDateDesc);
    return { key, label: `${y}년 ${parseInt(m, 10)}월`, ...groupTotals(sorted), items: sorted };
  });
}

// ISO주(월~일) 그룹. records 는 같은 달 가정. N주차 = 그 달 첫 ISO주를 1주차로. 최근주 우선.
export function groupByWeek(records) {
  if (records.length === 0) return [];
  const ref = new Date(records[0].date);
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const firstWeekMs = isoWeekStart(monthStart).getTime();
  const map = new Map();
  for (const r of records) {
    const ws = isoWeekStart(r.date);
    const key = ws.toISOString();
    if (!map.has(key)) map.set(key, { ws, items: [] });
    map.get(key).items.push(r);
  }
  return [...map.entries()].sort(keyDesc).map(([key, { ws, items }]) => {
    const weekNo = Math.round((ws.getTime() - firstWeekMs) / (7 * 86400000)) + 1;
    const end = new Date(ws);
    end.setDate(end.getDate() + 6);
    const sorted = [...items].sort(byDateDesc);
    return {
      key,
      label: `${weekNo}주차`,
      rangeLabel: `${ws.getMonth() + 1}/${ws.getDate()}~${end.getMonth() + 1}/${end.getDate()}`,
      ...groupTotals(sorted),
      items: sorted,
    };
  });
}

// 날짜(YYYY-MM-DD) 그룹. 최근일 우선.
export function groupByDay(records) {
  const map = new Map();
  for (const r of records) {
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return [...map.entries()].sort(keyDesc).map(([key, items]) => {
    const d = new Date(items[0].date);
    const sorted = [...items].sort(byDateDesc);
    return {
      key,
      label: `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAY_KR[d.getDay()]})`,
      ...groupTotals(sorted),
      items: sorted,
    };
  });
}

function scopeRecords(records, scope, now = new Date()) {
  if (scope === 'all' || !scope) return records;
  const ym = ymOfDate(now);
  return records.filter((r) => ymOf(r.date) === ym);
}

export function kpiSummary(records, now = new Date()) {
  const ym = ymOfDate(now);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYm = ymOfDate(prev);
  const thisMonth = records.filter((r) => ymOf(r.date) === ym);
  const lastMonth = records.filter((r) => ymOf(r.date) === prevYm);
  const thisMonthTotal = sum(thisMonth, (r) => r.final);
  const lastMonthTotal = sum(lastMonth, (r) => r.final);
  const count = thisMonth.length;
  const avgPerTxn = count ? Math.round(thisMonthTotal / count) : 0;
  const momRatePct = lastMonthTotal
    ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)
    : null;
  const cumulativeTotal = sum(records, (r) => r.final);
  const byDay = {};
  for (const r of thisMonth) {
    const day = new Date(r.date).getDate();
    byDay[day] = (byDay[day] || 0) + (Number(r.final) || 0);
  }
  const days = Object.entries(byDay).map(([d, t]) => ({ day: Number(d), total: t }));
  const bestDay = days.length ? days.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  const worstDay = days.length ? days.reduce((a, b) => (b.total < a.total ? b : a)) : null;
  return { thisMonthTotal, lastMonthTotal, count, avgPerTxn, momRatePct, cumulativeTotal, bestDay, worstDay };
}

export function monthlyTrend(records, monthsBack = 6, now = new Date()) {
  const out = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = ymOfDate(d);
    const inMonth = records.filter((r) => ymOf(r.date) === ym);
    out.push({
      ym,
      total: sum(inMonth, (r) => r.final),
      cash: sum(inMonth.filter((r) => r.type === '현금'), (r) => r.final),
      card: sum(inMonth.filter((r) => r.type === '카드'), (r) => r.final),
    });
  }
  return out;
}

export function dailySales(records, now = new Date()) {
  const ym = ymOfDate(now);
  const inMonth = records.filter((r) => ymOf(r.date) === ym);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const out = [];
  for (let day = 1; day <= last; day++) {
    const t = sum(inMonth.filter((r) => new Date(r.date).getDate() === day), (r) => r.final);
    out.push({ day, total: t });
  }
  return out;
}

export function byWeekday(records) {
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  const totals = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (const r of records) {
    const w = new Date(r.date).getDay();
    totals[w] += Number(r.final) || 0;
    counts[w] += 1;
  }
  return names.map((weekday, i) => ({
    weekday,
    total: totals[i],
    avg: counts[i] ? Math.round(totals[i] / counts[i]) : 0,
  }));
}

export function byHour(records) {
  const totals = Array(24).fill(0);
  for (const r of records) {
    const h = new Date(r.date).getHours();
    totals[h] += Number(r.final) || 0;
  }
  return totals.map((total, hour) => ({ hour, total }));
}

export function samePeriodCompare(records, now = new Date()) {
  const ym = ymOfDate(now);
  const lastM = ymOfDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastY = ymOfDate(new Date(now.getFullYear() - 1, now.getMonth(), 1));
  const tot = (k) => sum(records.filter((r) => ymOf(r.date) === k), (r) => r.final);
  return { thisMonth: tot(ym), lastMonth: tot(lastM), lastYear: tot(lastY) };
}

export function cashCardRatio(records, scope = 'all', now = new Date()) {
  const rs = scopeRecords(records, scope, now);
  const cash = sum(rs.filter((r) => r.type === '현금'), (r) => r.final);
  const card = sum(rs.filter((r) => r.type === '카드'), (r) => r.final);
  const total = cash + card;
  return {
    cash, card,
    cashPct: total ? Math.round((cash / total) * 100) : 0,
    cardPct: total ? Math.round((card / total) * 100) : 0,
  };
}

export function cardFeeTotal(records, scope = 'all', now = new Date()) {
  const rs = scopeRecords(records, scope, now);
  return sum(rs.filter((r) => r.type === '카드'), (r) => (Number(r.original) || 0) - (Number(r.final) || 0));
}

export function originalVsFinal(records, scope = 'all', now = new Date()) {
  const rs = scopeRecords(records, scope, now);
  return { original: sum(rs, (r) => r.original), final: sum(rs, (r) => r.final) };
}

export function topTransactions(records, n = 5) {
  return [...records].sort((a, b) => (Number(b.final) || 0) - (Number(a.final) || 0)).slice(0, n);
}

export function byCustomer(records) {
  const map = new Map();
  for (const r of records) {
    const name = (r.name || '').trim();
    if (!name) continue;
    const cur = map.get(name) || { name, total: 0, count: 0 };
    cur.total += Number(r.final) || 0;
    cur.count += 1;
    map.set(name, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function forecast(records, now = new Date()) {
  const ym = ymOfDate(now);
  const inMonth = records.filter((r) => ymOf(r.date) === ym);
  const total = sum(inMonth, (r) => r.final);
  const today = now.getDate();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (today === 0) return total;
  return Math.round((total / today) * last);
}

export function toCSV(records) {
  const header = ['id', 'date', 'type', 'original', 'final', 'name'];
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const r of records) {
    lines.push([r.id, r.date, r.type, r.original, r.final, r.name].map(escape).join(','));
  }
  return lines.join('\n');
}
