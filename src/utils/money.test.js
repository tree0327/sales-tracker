import { describe, it, expect } from 'vitest';
import { fmt, fmtSigned, cardFinal, computeFinal, buildUpdatePatch } from './money';

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

describe('buildUpdatePatch', () => {
  it('매출 카드는 수수료 10%를 뗀 final을 만든다', () => {
    const patch = buildUpdatePatch({
      flow: 'income', category: '매출', method: '카드',
      amount: 100000, memo: ' 염색 ', date: '2026-07-16T03:00:00Z',
    });
    expect(patch).toEqual({
      flow: 'income', category: '매출',
      amount: 100000, final: 90000, method: '카드',
      memo: '염색', date: '2026-07-16T03:00:00Z',
    });
  });

  it('flow 와 category 도 패치에 포함한다 (수정 시트의 카테고리·유형 변경)', () => {
    const patch = buildUpdatePatch({
      flow: 'expense', category: '교통', method: '카드',
      amount: 12000, memo: '', date: '2026-07-16T03:00:00Z', owner: 'wife',
    });
    expect(patch.flow).toBe('expense');
    expect(patch.category).toBe('교통');
  });

  it('매출 현금은 원금 그대로다', () => {
    const patch = buildUpdatePatch({
      flow: 'income', category: '매출', method: '현금', amount: 70000, memo: '', date: '2026-07-16T03:00:00Z',
    });
    expect(patch.final).toBe(70000);
  });

  it('금액이 비어 있으면 0으로 정규화한다', () => {
    const patch = buildUpdatePatch({
      flow: 'income', category: '매출', method: '현금', amount: '', memo: null, date: '2026-07-16T03:00:00Z',
    });
    expect(patch.amount).toBe(0);
    expect(patch.final).toBe(0);
    expect(patch.memo).toBe('');
  });

  it('급여는 결제수단을 계좌로 강제한다 (addTransaction 과 동일 규칙)', () => {
    const patch = buildUpdatePatch({
      flow: 'income', category: '급여', method: '카드',
      amount: 3000000, memo: '7월 월급', date: '2026-07-15T03:00:00Z',
    });
    expect(patch.method).toBe('계좌');
  });

  it('매출은 결제수단을 그대로 둔다', () => {
    const patch = buildUpdatePatch({
      flow: 'income', category: '매출', method: '카드',
      amount: 100000, memo: '', date: '2026-07-16T03:00:00Z',
    });
    expect(patch.method).toBe('카드');
  });

  it('owner 를 넘기면 패치에 포함한다 (수정 시트의 소유자 변경)', () => {
    const patch = buildUpdatePatch({
      flow: 'expense', category: '식비', method: '카드',
      amount: 12000, memo: '', date: '2026-07-16T03:00:00Z', owner: 'joint',
    });
    expect(patch.owner).toBe('joint');
  });

  it('owner 를 안 넘기면 패치에 owner 키 자체가 없다 (매출 수정 경로 — 소유자 불변)', () => {
    const patch = buildUpdatePatch({
      flow: 'income', category: '매출', method: '카드',
      amount: 100000, memo: '', date: '2026-07-16T03:00:00Z',
    });
    expect('owner' in patch).toBe(false);
  });
});
