import { describe, it, expect } from 'vitest';
import { buildRecordDateISO, localYMD, resolveSheetDate } from './recordDate.js';

describe('localYMD', () => {
  it('Date 를 로컬 기준 YYYY-MM-DD 로 만든다 (UTC 아님)', () => {
    // KST(UTC+9)에서 2026-07-18 00:30 은 UTC 로는 7/17 — toISOString 이었다면 하루 밀린다.
    const d = new Date(2026, 6, 18, 0, 30, 0);
    expect(localYMD(d)).toBe('2026-07-18');
  });

  it('ISO 문자열도 로컬 날짜로 변환한다', () => {
    const d = new Date(2026, 0, 5, 8, 0, 0); // 로컬 1/5 08:00 — UTC 로는 1/4 밤일 수 있는 시각
    expect(localYMD(d.toISOString())).toBe('2026-01-05');
  });

  it('한 자리 월·일은 0 패딩한다', () => {
    expect(localYMD(new Date(2026, 2, 7, 12, 0, 0))).toBe('2026-03-07');
  });
});

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

describe('resolveSheetDate', () => {
  it("'오늘'은 현재 시각 그대로", () => {
    const now = new Date(2026, 6, 18, 14, 30, 0);
    const dt = new Date(resolveSheetDate('오늘', now));
    expect(dt.getDate()).toBe(18);
    expect(dt.getHours()).toBe(14); // 12시 고정 버그 회귀 방지
  });
  it("'어제'는 하루 전 + 현재 시각", () => {
    const now = new Date(2026, 6, 18, 9, 5, 0);
    const dt = new Date(resolveSheetDate('어제', now));
    expect(dt.getDate()).toBe(17);
    expect(dt.getHours()).toBe(9);
  });
  it('YYYY-MM-DD 는 그 날짜 + 현재 시각', () => {
    const now = new Date(2026, 6, 18, 22, 45, 0);
    const dt = new Date(resolveSheetDate('2026-07-01', now));
    expect(dt.getMonth()).toBe(6);
    expect(dt.getDate()).toBe(1);
    expect(dt.getHours()).toBe(22);
  });
  it('월초로 어제가 지난달이면 달을 넘긴다', () => {
    const now = new Date(2026, 7, 1, 10, 0, 0); // 8/1
    const dt = new Date(resolveSheetDate('그저께', now));
    expect(dt.getMonth()).toBe(6); // 7월
    expect(dt.getDate()).toBe(30);
  });
});
