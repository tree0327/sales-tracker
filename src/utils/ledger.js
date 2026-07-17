// 거래/고정지출 목록에서 파생 값(합계·잔액·그룹)을 계산한다. 순수 함수 모음.

const num = (v) => Number(v) || 0;

export function sumFinal(list) {
  return list.reduce((a, t) => a + num(t.final ?? t.amount), 0);
}
export function sumAmount(list) {
  return list.reduce((a, t) => a + num(t.amount), 0);
}

export function fixedTotal(fixed) {
  return fixed.reduce((a, f) => a + num(f.amount), 0);
}

export function incomeList(transactions) {
  return transactions.filter((t) => t.flow === 'income');
}
export function expenseList(transactions) {
  return transactions.filter((t) => t.flow === 'expense');
}

// 이번 달 흐름: -고정 + 수입 - 지출 = 잔액
export function monthlyFlow(transactions, fixed) {
  const income = sumFinal(incomeList(transactions));
  const expense = sumAmount(expenseList(transactions));
  const fixedT = fixedTotal(fixed);
  return { fixed: fixedT, income, expense, balance: -fixedT + income - expense };
}

// 특정 소유자의 변동지출 목록
export function expenseByOwner(transactions, owner) {
  return expenseList(transactions).filter((t) => t.owner === owner);
}

// 카테고리별 합계 (내림차순)
export function byCategory(list) {
  const map = new Map();
  for (const t of list) map.set(t.category, (map.get(t.category) || 0) + num(t.amount));
  return [...map.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
}

// --- 날짜 헬퍼 ---
export function txMonth(t) {
  return new Date(t.date).getMonth() + 1; // 1..12
}
export function txDayKey(t) {
  const d = new Date(t.date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
export function isSameMonth(t, month, year) {
  const d = new Date(t.date);
  return d.getMonth() + 1 === month && d.getFullYear() === year;
}

// 서명 금액: 수입 +final, 지출 -amount
export function signedAmount(t) {
  return t.flow === 'income' ? num(t.final ?? t.amount) : -num(t.amount);
}

// 날짜별 그룹핑 (최신일 우선)
export function groupByDay(list) {
  const groups = new Map();
  for (const t of list) {
    const key = txDayKey(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const days = [...groups.keys()].sort((a, b) => rank(b) - rank(a));
  return days.map((day) => ({ day, items: groups.get(day) }));
}
function rank(dayKey) {
  const [m, d] = dayKey.split('/').map((x) => parseInt(x, 10));
  return m * 100 + d;
}

// --- 예산 ---
export const OVERALL = '__overall__';
export function budgetMap(budgets) {
  const m = {};
  for (const b of budgets) m[b.scope] = Number(b.amount) || 0;
  return m;
}

// --- 월별 추이(분석용) ---
// base 기준 최근 n개월(오래된→최신) 각 월의 수입/지출/미용실매출 합계.
export function lastNMonths(base, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(base.getFullYear(), base.getMonth() - i, 1);
    out.push({ year: dd.getFullYear(), month: dd.getMonth() + 1, label: `${dd.getMonth() + 1}월` });
  }
  return out;
}
export function monthlyTrend(transactions, base, n = 6) {
  return lastNMonths(base, n).map(({ year, month, label }) => {
    const inM = transactions.filter((t) => isSameMonth(t, month, year));
    return {
      year, month, label,
      income: sumFinal(inM.filter((t) => t.flow === 'income')),
      expense: sumAmount(inM.filter((t) => t.flow === 'expense')),
      salon: sumFinal(inM.filter((t) => t.flow === 'income' && t.category === '매출')),
    };
  });
}
