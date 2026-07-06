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
