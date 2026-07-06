import { describe, it, expect } from 'vitest';
import { prevPeriodKey, reportSeenKey, shouldShowReport } from './monthlyReport.js';

describe('prevPeriodKey', () => {
  it('직전 달 키를 YYYY-MM으로 반환', () => {
    expect(prevPeriodKey(new Date(2026, 6, 3))).toBe('2026-06'); // 7월 → 6월
  });
  it('1월이면 전년 12월', () => {
    expect(prevPeriodKey(new Date(2026, 0, 1))).toBe('2025-12');
  });
});

describe('reportSeenKey', () => {
  it('열람 키 형식', () => {
    expect(reportSeenKey('2026-06')).toBe('report_seen_2026-06');
  });
});

describe('shouldShowReport', () => {
  const now = new Date(2026, 6, 1);
  it('직전월 기록 있고 미열람 → true', () => {
    expect(shouldShowReport({ now, hasPrevData: true, isSeen: false })).toBe(true);
  });
  it('이미 열람 → false', () => {
    expect(shouldShowReport({ now, hasPrevData: true, isSeen: true })).toBe(false);
  });
  it('직전월 기록 없음 → false', () => {
    expect(shouldShowReport({ now, hasPrevData: false, isSeen: false })).toBe(false);
  });
});
