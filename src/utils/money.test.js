import { describe, it, expect } from 'vitest';
import { fmt, fmtSigned, cardFinal, computeFinal } from './money';

describe('money', () => {
  it('fmt: 천단위 콤마 + 음수는 −', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(1234567)).toBe('1,234,567');
    expect(fmt(-90000)).toBe('−90,000');
  });

  it('fmtSigned: 부호를 항상 붙인다', () => {
    expect(fmtSigned(1000)).toBe('+1,000');
    expect(fmtSigned(-1000)).toBe('−1,000');
    expect(fmtSigned(0)).toBe('+0');
  });

  it('cardFinal: 원금의 90% (floor)', () => {
    expect(cardFinal(100000)).toBe(90000);
    expect(cardFinal(111)).toBe(99); // floor(99.9)
  });

  it('computeFinal: 매출+카드만 수수료 차감', () => {
    expect(computeFinal({ flow: 'income', category: '매출', method: '카드', amount: 100000 })).toBe(90000);
    expect(computeFinal({ flow: 'income', category: '매출', method: '현금', amount: 100000 })).toBe(100000);
    expect(computeFinal({ flow: 'income', category: '급여', method: '계좌', amount: 3000000 })).toBe(3000000);
    expect(computeFinal({ flow: 'expense', category: '식비', method: '카드', amount: 12000 })).toBe(12000);
  });
});
