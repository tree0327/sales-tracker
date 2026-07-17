import { describe, it, expect } from 'vitest';
import { monthlyFlow, byCategory, signedAmount, expenseByOwner, groupByDay } from './ledger';

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
});
