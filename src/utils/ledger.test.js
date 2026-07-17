import { describe, it, expect } from 'vitest';
import { monthlyFlow, byCategory, signedAmount, expenseByOwner, groupByDay, budgetMap, lastNMonths, monthlyTrend } from './ledger';

const tx = (o) => ({ method: '카드', ...o });

describe('ledger', () => {
  it('monthlyFlow: 잔액 = -고정 + 수입 - 지출', () => {
    const transactions = [
      tx({ flow: 'income', category: '급여', owner: 'husband', amount: 3000000, final: 3000000 }),
      tx({ flow: 'income', category: '매출', owner: 'wife', amount: 100000, final: 90000 }), // 카드 실수령 반영
      tx({ flow: 'expense', category: '생활', owner: 'joint', amount: 50000 }),
    ];
    const fixed = [{ amount: 1850000 }];
    const f = monthlyFlow(transactions, fixed);
    expect(f.fixed).toBe(1850000);
    expect(f.income).toBe(3090000); // final 합
    expect(f.expense).toBe(50000);
    expect(f.balance).toBe(-1850000 + 3090000 - 50000);
  });

  it('byCategory: 카테고리 합계 내림차순', () => {
    const list = [
      tx({ flow: 'expense', category: '식비', amount: 10000 }),
      tx({ flow: 'expense', category: '쇼핑', amount: 50000 }),
      tx({ flow: 'expense', category: '식비', amount: 5000 }),
    ];
    const r = byCategory(list);
    expect(r[0]).toEqual({ name: '쇼핑', amount: 50000 });
    expect(r[1]).toEqual({ name: '식비', amount: 15000 });
  });

  it('signedAmount: 수입은 +final, 지출은 -amount', () => {
    expect(signedAmount(tx({ flow: 'income', amount: 100000, final: 90000 }))).toBe(90000);
    expect(signedAmount(tx({ flow: 'expense', amount: 30000 }))).toBe(-30000);
  });

  it('expenseByOwner: 소유자별 변동지출만', () => {
    const transactions = [
      tx({ flow: 'expense', owner: 'wife', amount: 1000 }),
      tx({ flow: 'expense', owner: 'husband', amount: 2000 }),
      tx({ flow: 'income', owner: 'wife', amount: 5000, final: 5000 }),
    ];
    expect(expenseByOwner(transactions, 'wife')).toHaveLength(1);
  });

  it('groupByDay: 최신일 우선 그룹', () => {
    const list = [
      tx({ flow: 'expense', amount: 1, date: '2026-07-15T03:00:00Z' }),
      tx({ flow: 'expense', amount: 2, date: '2026-07-17T03:00:00Z' }),
    ];
    const g = groupByDay(list);
    expect(g[0].day).toBe('7/17');
    expect(g[1].day).toBe('7/15');
  });

  it('budgetMap: scope→amount 맵', () => {
    const m = budgetMap([{ scope: '__overall__', amount: 900000 }, { scope: '식비', amount: 300000 }]);
    expect(m['__overall__']).toBe(900000);
    expect(m['식비']).toBe(300000);
    expect(m['없음']).toBeUndefined();
  });

  it('lastNMonths: base 기준 최근 n개월(오래된→최신)', () => {
    const r = lastNMonths(new Date(2026, 6, 15), 6); // 7월 기준
    expect(r).toHaveLength(6);
    expect(r[0]).toMatchObject({ year: 2026, month: 2, label: '2월' });
    expect(r[5]).toMatchObject({ year: 2026, month: 7, label: '7월' });
  });

  it('monthlyTrend: 월별 수입/지출/미용실매출 합계', () => {
    const transactions = [
      tx({ flow: 'income', category: '급여', amount: 3000000, final: 3000000, date: '2026-07-10T03:00:00Z' }),
      tx({ flow: 'income', category: '매출', amount: 100000, final: 90000, date: '2026-07-11T03:00:00Z' }),
      tx({ flow: 'expense', category: '식비', amount: 50000, date: '2026-07-12T03:00:00Z' }),
      tx({ flow: 'expense', category: '식비', amount: 10000, date: '2026-06-12T03:00:00Z' }),
    ];
    const r = monthlyTrend(transactions, new Date(2026, 6, 1), 6);
    const jul = r[5];
    expect(jul).toMatchObject({ month: 7, income: 3090000, expense: 50000, salon: 90000 });
    expect(r[4].expense).toBe(10000); // 6월
  });
});
