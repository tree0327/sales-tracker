import { describe, it, expect } from 'vitest';
import { toSalesRecord, salesRecords } from './salesAdapter';

const 매출카드 = { id: 2, flow: 'income', category: '매출', owner: 'wife', amount: 100000, final: 90000, method: '카드', date: '2026-07-16T03:00:00Z', memo: '염색' };
const 매출현금 = { id: 3, flow: 'income', category: '매출', owner: 'wife', amount: 70000, final: 70000, method: '현금', date: '2026-07-16T03:00:00Z', memo: '' };
const 급여 = { id: 1, flow: 'income', category: '급여', owner: 'husband', amount: 3000000, final: 3000000, method: '계좌', date: '2026-07-15T03:00:00Z', memo: '7월 월급' };
const 지출 = { id: 4, flow: 'expense', category: '생활', owner: 'joint', amount: 64300, method: '카드', date: '2026-07-16T03:00:00Z', memo: '장보기' };
const 충전 = { id: 8, flow: 'transfer', category: '공금충전', owner: 'wife', amount: 200000, final: 200000, method: '계좌', date: '2026-07-01T03:00:00Z', memo: '' };

describe('toSalesRecord', () => {
  it('method→type, amount→original, memo→name 으로 매핑한다', () => {
    expect(toSalesRecord(매출카드)).toEqual({
      id: 2, type: '카드', original: 100000, final: 90000, name: '염색', date: '2026-07-16T03:00:00Z',
    });
  });

  it('memo 가 없으면 name 은 빈 문자열이다', () => {
    expect(toSalesRecord(매출현금).name).toBe('');
  });
});

describe('salesRecords', () => {
  it('매출만 남기고 급여·지출·공금충전은 제외한다', () => {
    const out = salesRecords([매출카드, 매출현금, 급여, 지출, 충전]);
    expect(out.map((r) => r.id)).toEqual([2, 3]);
  });

  it('매출이 없으면 빈 배열이다', () => {
    expect(salesRecords([급여, 지출])).toEqual([]);
  });
});
