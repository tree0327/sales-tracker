import { kpiSummary, cashCardRatio, dailySales } from './analytics.js';

// 월 리포트 객체 → AI 전송용 compact payload
export function buildReportPayload(report) {
  if (!report) return null;
  return {
    월: report.ym,
    총매출: report.total,
    거래건수: report.count,
    건당평균: report.avgPerTxn,
    전월대비퍼센트: report.momRatePct,
    현금: report.cash,
    카드: report.card,
    카드수수료: report.cardFee,
    최고매출일: report.bestDay,
    최고거래: (report.top3 || []).map((r) => ({ 이름: r.name || r.type, 금액: r.final })),
  };
}

// 챗봇용 매출 요약 컨텍스트(토큰 절약을 위해 compact)
export function buildChatContext(salesData, now = new Date()) {
  const k = kpiSummary(salesData, now);
  const ratio = cashCardRatio(salesData, 'month', now);
  return {
    이번달총매출: k.thisMonthTotal,
    전월총매출: k.lastMonthTotal,
    전월대비퍼센트: k.momRatePct,
    거래건수: k.count,
    건당평균: k.avgPerTxn,
    누적총매출: k.cumulativeTotal,
    이번달현금: ratio.cash,
    이번달카드: ratio.card,
    최고매출일: k.bestDay,
  };
}

// 이상치 감지(순수): 전월 대비 급변(±30%↑) + 이번 달 일별 스파이크(평균 2배↑)
export function detectAnomalies(salesData, now = new Date()) {
  const out = [];
  const k = kpiSummary(salesData, now);
  if (k.momRatePct !== null && Math.abs(k.momRatePct) >= 30) {
    out.push({
      유형: '전월대비급변',
      방향: k.momRatePct < 0 ? '급감' : '급등',
      상세: `전월 대비 ${k.momRatePct > 0 ? '+' : ''}${k.momRatePct}% (이번달 ${k.thisMonthTotal}원, 전월 ${k.lastMonthTotal}원)`,
    });
  }
  const daily = dailySales(salesData, now).filter((d) => d.total > 0);
  if (daily.length >= 3) {
    const mean = daily.reduce((s, d) => s + d.total, 0) / daily.length;
    for (const d of daily) {
      if (d.total >= mean * 2) {
        out.push({ 유형: '일별급등', 상세: `${d.day}일 매출 ${d.total}원 (평균의 ${(d.total / mean).toFixed(1)}배)` });
      }
    }
  }
  return out;
}
