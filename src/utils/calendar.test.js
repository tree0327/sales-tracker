import { describe, it, expect } from 'vitest';
import { daysInMonth, calendarGrid, dailySpend, monthSummary, dayExpenses } from './calendar';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).toISOString();

const TX = [
  { id: 1, flow: 'expense', category: '식비', amount: 30000, date: at(2026, 8, 3) },
  { id: 2, flow: 'expense', category: '식비', amount: 12000, date: at(2026, 8, 3, 19) },
  { id: 3, flow: 'expense', category: '생활', amount: 80000, date: at(2026, 8, 10) },
  { id: 4, flow: 'income', category: '매출', amount: 200000, final: 200000, date: at(2026, 8, 10) },
  { id: 5, flow: 'transfer', category: '공금충전', amount: 500000, date: at(2026, 8, 10) },
  { id: 6, flow: 'expense', category: '식비', amount: 9000, date: at(2026, 7, 30) }, // 지난달
];

describe('daysInMonth / calendarGrid', () => {
  it('말일을 정확히 센다 (윤년 포함)', () => {
    expect(daysInMonth(2026, 8)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  it('일요일 시작 + 7의 배수 길이, 앞 빈칸은 1일의 요일만큼', () => {
    const g = calendarGrid(2026, 8); // 2026-08-01 = 토요일
    expect(g.length % 7).toBe(0);
    expect(g.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(g[6]).toBe(1);
    expect(g.filter((c) => c !== null)).toHaveLength(31);
  });
});

describe('dailySpend', () => {
  it('그 달 지출만 날짜별로 합산한다 (수입·공금충전·타월 제외)', () => {
    expect(dailySpend(TX, 2026, 8)).toEqual({ 3: 42000, 10: 80000 });
  });
});

describe('monthSummary', () => {
  it('이번 달이면 오늘까지의 경과일로 평균을 낸다', () => {
    const now = new Date(2026, 7, 20, 15); // 2026-08-20
    const s = monthSummary(TX, 2026, 8, now);
    expect(s.total).toBe(122000);
    expect(s.count).toBe(3);
    expect(s.elapsedDays).toBe(20);
    expect(s.dailyAvg).toBe(6100); // 122,000 / 20
  });

  it('지난 달이면 그 달 전체 일수로 나눈다', () => {
    const now = new Date(2026, 8, 5); // 2026-09-05
    const s = monthSummary(TX, 2026, 8, now);
    expect(s.elapsedDays).toBe(31);
    expect(s.dailyAvg).toBe(Math.round(122000 / 31));
  });

  it('아직 오지 않은 달은 평균을 내지 않는다 (0으로 나누기 방지)', () => {
    const now = new Date(2026, 7, 20);
    const s = monthSummary(TX, 2026, 12, now);
    expect(s).toMatchObject({ total: 0, count: 0, elapsedDays: 0, dailyAvg: 0 });
  });
});

describe('dayExpenses', () => {
  it('그날 지출만 최신순으로 준다 (수입 제외)', () => {
    expect(dayExpenses(TX, 2026, 8, 3).map((t) => t.id)).toEqual([2, 1]);
    expect(dayExpenses(TX, 2026, 8, 10).map((t) => t.id)).toEqual([3]);
    expect(dayExpenses(TX, 2026, 8, 5)).toEqual([]);
  });
});
