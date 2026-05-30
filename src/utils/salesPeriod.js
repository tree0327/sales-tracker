// 매출 정산 기간 계산 유틸리티 (정산월 = 달력월: 1일 ~ 말일)

// 이번 달 1일 ~ 다음 달 1일(미포함 경계). 필터는 date < end 로 비교.
export function getSalesPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1, 0, 0, 0);
  const end = new Date(year, month + 1, 1, 0, 0, 0);
  return { start, end };
}

// 주어진 날짜가 속한 정산월 키 "YYYY-MM"
export function getPeriodKey(dateString) {
  const dt = new Date(dateString);
  const y = dt.getFullYear();
  const m = dt.getMonth();
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

// 정산월의 말일 Date (표시용). 다음달 0일 = 이번달 말일.
export function getPeriodEndDay(start = new Date()) {
  const y = start.getFullYear();
  const m = start.getMonth();
  return new Date(y, m + 1, 0);
}
