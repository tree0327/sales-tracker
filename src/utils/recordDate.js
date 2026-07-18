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

// 로컬 기준 YYYY-MM-DD. date input 의 값·max 에 쓴다.
// toISOString().slice(0,10) 은 UTC 날짜라 KST 00~09시에 하루 밀린다 — 그 대체.
export function localYMD(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 입력 시트의 날짜 선택('오늘'/'어제'/'그저께' 칩 또는 달력 YYYY-MM-DD)을 ISO 로.
// 시각은 항상 now 의 시:분:초 — 예전 '정오 12시 고정' 버그를 대체한다.
export function resolveSheetDate(opt, now = new Date()) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(opt)) return buildRecordDateISO(opt, null, now);
  const d = new Date(now);
  if (opt === '어제') d.setDate(d.getDate() - 1);
  if (opt === '그저께') d.setDate(d.getDate() - 2);
  return buildRecordDateISO(localYMD(d), null, now);
}
