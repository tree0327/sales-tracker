import { describe, it, expect } from 'vitest';
import { applyRealtimeEvent } from './realtimeMerge';

const a = { id: 1, amount: 100, date: '2026-07-15T03:00:00Z' };
const b = { id: 2, amount: 200, date: '2026-07-16T03:00:00Z' };

describe('applyRealtimeEvent', () => {
  it('INSERT: 새 행을 넣고 date 내림차순 정렬', () => {
    const c = { id: 3, amount: 300, date: '2026-07-17T03:00:00Z' };
    const out = applyRealtimeEvent([b, a], { eventType: 'INSERT', new: c, old: {} }, { sortByDateDesc: true });
    expect(out.map((r) => r.id)).toEqual([3, 2, 1]);
  });
  it('INSERT: 이미 있는 id 면 중복 삽입하지 않는다(자기 발신 낙관적 갱신과의 중복)', () => {
    const out = applyRealtimeEvent([b, a], { eventType: 'INSERT', new: { ...a }, old: {} }, { sortByDateDesc: true });
    expect(out).toHaveLength(2);
  });
  it('UPDATE: 해당 id 를 교체한다', () => {
    const out = applyRealtimeEvent([b, a], { eventType: 'UPDATE', new: { ...a, amount: 999 }, old: {} });
    expect(out.find((r) => r.id === 1).amount).toBe(999);
  });
  it('UPDATE: 없는 id 면 삽입한다(놓친 INSERT 보정)', () => {
    const c = { id: 3, amount: 300, date: '2026-07-14T03:00:00Z' };
    const out = applyRealtimeEvent([b, a], { eventType: 'UPDATE', new: c, old: {} }, { sortByDateDesc: true });
    expect(out.map((r) => r.id)).toEqual([2, 1, 3]);
  });
  it('DELETE: old.id 로 제거한다', () => {
    const out = applyRealtimeEvent([b, a], { eventType: 'DELETE', new: {}, old: { id: 2 } });
    expect(out.map((r) => r.id)).toEqual([1]);
  });
  it('원본 배열을 변형하지 않는다', () => {
    const src = [b, a];
    applyRealtimeEvent(src, { eventType: 'DELETE', new: {}, old: { id: 1 } });
    expect(src).toHaveLength(2);
  });
});
