// 선택한 날짜(YYYY-MM-DD)에 실제 시각을 결합해 정확한 타임스탬프(ISO)를 만든다.
// - 신규 입력(timeSourceISO 없음): 현재 시각(now)의 시:분:초를 사용 → 입력 시각이 정확히 반영됨.
// - 수정(timeSourceISO 있음): 원래 기록의 시각을 보존하고 날짜만 바꾼다.
// 기존 버그(항상 정오 'T12:00:00' 하드코딩)를 대체한다.
export function buildRecordDateISO(selectedDate, timeSourceISO = null, now = new Date()) {
  const src = timeSourceISO ? new Date(timeSourceISO) : now;
  const [y, m, d] = selectedDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d, src.getHours(), src.getMinutes(), src.getSeconds());
  return dt.toISOString();
}
