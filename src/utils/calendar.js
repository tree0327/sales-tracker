// 캘린더 화면의 파생값. 순수 함수 모음.

const num = (v) => Number(v) || 0;

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // month 는 1..12
}

// 달력 그리드: 일요일 시작, 앞뒤 빈칸은 null. 항상 7의 배수 길이.
export function calendarGrid(year, month) {
  const lead = new Date(year, month - 1, 1).getDay(); // 0=일
  const total = daysInMonth(year, month);
  const cells = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// 날짜(일) → 그날 지출 합계. 수입과 공금충전(transfer)은 제외.
export function dailySpend(transactions, year, month) {
  const by = {};
  for (const t of transactions) {
    if (t.flow !== 'expense') continue;
    const d = new Date(t.date);
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;
    const day = d.getDate();
    by[day] = (by[day] || 0) + num(t.amount);
  }
  return by;
}

// 달력 하단 요약: 그 달 총 지출 + 건수 + 하루 평균.
// 평균은 '지출이 있었던 날'이 아니라 경과일 기준 — 이번 달이면 오늘까지, 지난 달이면 말일까지.
// 아직 안 온 날까지 나누면 평균이 실제보다 낮게 나와 "이 페이스면 괜찮다"고 오해하게 된다.
export function monthSummary(transactions, year, month, now = new Date()) {
  const list = transactions.filter((t) => {
    if (t.flow !== 'expense') return false;
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  const total = list.reduce((a, t) => a + num(t.amount), 0);
  const isThisMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const isFuture = new Date(year, month - 1, 1) > now;
  const elapsed = isFuture ? 0 : isThisMonth ? now.getDate() : daysInMonth(year, month);
  return {
    total,
    count: list.length,
    elapsedDays: elapsed,
    dailyAvg: elapsed > 0 ? Math.round(total / elapsed) : 0,
  };
}

// 그날의 지출 목록 (최신순). 날짜 팝업에서 확인·삭제하려고 쓴다.
export function dayExpenses(transactions, year, month, day) {
  return transactions
    .filter((t) => {
      if (t.flow !== 'expense') return false;
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}
