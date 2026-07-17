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
