import { describe, it, expect } from 'vitest';
import { monthlyReport } from './analytics.js';

// 2026-05 데이터: 현금 10000(5/2), 카드 원금 20000→final 18000(5/2), 현금 5000(5/10)
// 2026-04 데이터(전월): 현금 10000 → 전월 총 10000
const records = [
  { id: 1, type: '현금', original: 10000, final: 10000, name: 'A', date: '2026-05-02T09:00:00.000Z' },
  { id: 2, type: '카드', original: 20000, final: 18000, name: 'B', date: '2026-05-02T11:00:00.000Z' },
  { id: 3, type: '현금', original: 5000, final: 5000, name: 'C', date: '2026-05-10T15:00:00.000Z' },
  { id: 4, type: '현금', original: 10000, final: 10000, name: 'D', date: '2026-04-20T10:00:00.000Z' },
];

describe('monthlyReport', () => {
  const r = monthlyReport(records, new Date(2026, 4, 15)); // 2026-05

  it('대상 달과 총매출/건수/평균', () => {
    expect(r.ym).toBe('2026-05');
    expect(r.total).toBe(33000);   // 10000 + 18000 + 5000
    expect(r.count).toBe(3);
    expect(r.avgPerTxn).toBe(11000); // 33000 / 3
  });

  it('전월 대비 증감(%)', () => {
    // 전월(2026-04) 총 10000 → (33000-10000)/10000 = 230%
    expect(r.momRatePct).toBe(230);
  });

  it('현금/카드 구성과 수수료', () => {
    expect(r.cash).toBe(15000); // 10000 + 5000
    expect(r.card).toBe(18000);
    expect(r.cashPct).toBe(45); // 15000/33000 = 45.45 → 45
    expect(r.cardPct).toBe(55); // 18000/33000 = 54.5 → 55
    expect(r.cardFee).toBe(2000); // 20000 - 18000
  });

  it('최고 매출일과 TOP3', () => {
    expect(r.bestDay).toEqual({ day: 2, total: 28000 }); // 5/2: 10000+18000
    expect(r.top3.map((x) => x.id)).toEqual([2, 1, 3]); // 18000, 10000, 5000
  });

  it('데이터 없는 달은 0/빈값', () => {
    const empty = monthlyReport(records, new Date(2026, 0, 1)); // 2026-01
    expect(empty.total).toBe(0);
    expect(empty.count).toBe(0);
    expect(empty.avgPerTxn).toBe(0);
    expect(empty.momRatePct).toBe(null);
    expect(empty.bestDay).toBe(null);
    expect(empty.top3).toEqual([]);
  });
});
