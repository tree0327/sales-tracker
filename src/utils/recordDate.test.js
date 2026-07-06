import { describe, it, expect } from 'vitest';
import { buildRecordDateISO } from './recordDate.js';

describe('buildRecordDateISO', () => {
  it('신규 입력: 선택 날짜 + 실제 현재 시각을 반영(정오 고정 아님)', () => {
    const now = new Date(2026, 6, 6, 14, 37, 5); // 로컬 2026-07-06 14:37:05
    const dt = new Date(buildRecordDateISO('2026-07-06', null, now));
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(6); // 7월
    expect(dt.getDate()).toBe(6);
    expect(dt.getHours()).toBe(14);
    expect(dt.getMinutes()).toBe(37);
    expect(dt.getHours()).not.toBe(12); // 회귀 방지: 12시 하드코딩 금지
  });

  it('수정: 원래 기록의 시각을 보존하고 날짜만 바꾼다', () => {
    const orig = new Date(2026, 5, 1, 9, 15, 0).toISOString(); // 2026-06-01 09:15 로컬
    const dt = new Date(buildRecordDateISO('2026-06-15', orig, new Date(2026, 6, 6, 23, 0, 0)));
    expect(dt.getMonth()).toBe(5); // 6월
    expect(dt.getDate()).toBe(15); // 날짜는 변경됨
    expect(dt.getHours()).toBe(9); // 시각은 원본 보존
    expect(dt.getMinutes()).toBe(15);
  });

  it('과거 날짜로 신규 입력하면 현재 시각(시:분)을 붙인다', () => {
    const now = new Date(2026, 6, 6, 8, 5, 0); // 08:05
    const dt = new Date(buildRecordDateISO('2026-07-01', null, now));
    expect(dt.getDate()).toBe(1);
    expect(dt.getHours()).toBe(8);
    expect(dt.getMinutes()).toBe(5);
  });
});
