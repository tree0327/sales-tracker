import { describe, it, expect } from 'vitest';
import { buildReportPayload, buildChatContext, detectAnomalies } from './aiPayload.js';

const recs = (arr) => arr.map((r, i) => ({ id: i + 1, name: '', ...r }));

describe('buildReportPayload', () => {
  it('report 객체에서 핵심 필드를 뽑는다', () => {
    const p = buildReportPayload({
      ym: '2026-06', total: 1000, count: 4, avgPerTxn: 250, momRatePct: 20,
      cash: 600, card: 400, cardFee: 40, bestDay: { day: 3, total: 500 },
      top3: [{ name: '김', type: '카드', final: 300 }],
    });
    expect(p.월).toBe('2026-06');
    expect(p.총매출).toBe(1000);
    expect(p.카드수수료).toBe(40);
    expect(p.최고거래).toEqual([{ 이름: '김', 금액: 300 }]);
  });
  it('report가 없으면 null', () => {
    expect(buildReportPayload(null)).toBe(null);
  });
});

describe('detectAnomalies', () => {
  it('전월 대비 30% 이상 급변을 감지', () => {
    // 2026-06: 10000, 2026-05: 1000 → +900%
    const data = recs([
      { type: '현금', original: 10000, final: 10000, date: '2026-06-10T09:00:00.000Z' },
      { type: '현금', original: 1000, final: 1000, date: '2026-05-10T09:00:00.000Z' },
    ]);
    const out = detectAnomalies(data, new Date(2026, 5, 15));
    expect(out.some((a) => a.유형 === '전월대비급변')).toBe(true);
  });
  it('이상치 없으면 빈 배열', () => {
    const data = recs([{ type: '현금', original: 1000, final: 1000, date: '2026-06-10T09:00:00.000Z' }]);
    // 단일 기록, 전월 없음 → momRatePct null, 일별 3건 미만
    expect(detectAnomalies(data, new Date(2026, 5, 15))).toEqual([]);
  });
});

describe('buildChatContext', () => {
  it('요약 컨텍스트 키를 포함', () => {
    const data = recs([{ type: '카드', original: 1000, final: 900, date: '2026-06-10T09:00:00.000Z' }]);
    const c = buildChatContext(data, new Date(2026, 5, 15));
    expect(c).toHaveProperty('이번달총매출');
    expect(c).toHaveProperty('이번달카드');
    expect(c.이번달총매출).toBe(900);
  });
});
