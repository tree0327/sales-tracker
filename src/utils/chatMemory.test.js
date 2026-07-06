import { describe, it, expect } from 'vitest';
import { planSummarization, verbatimFrom, KEEP_MSGS, BATCH_MSGS } from './chatMemory.js';

describe('planSummarization', () => {
  it('미요약이 keep+batch 미만이면 요약 안 함', () => {
    expect(planSummarization(20, 0).shouldSummarize).toBe(false); // 20 < 30
    expect(planSummarization(29, 0).shouldSummarize).toBe(false); // 29 < 30
  });
  it('미요약이 keep+batch 이상이면 가장 오래된 batch를 요약', () => {
    const p = planSummarization(30, 0); // 30 >= 30
    expect(p.shouldSummarize).toBe(true);
    expect(p.from).toBe(0);
    expect(p.to).toBe(BATCH_MSGS); // 0..10
  });
  it('이미 일부 요약된 뒤 다시 임계 도달', () => {
    // summarizedCount=10, total=40 → 미요약 30 >= 30 → 10..20 요약
    const p = planSummarization(40, 10);
    expect(p.shouldSummarize).toBe(true);
    expect(p.from).toBe(10);
    expect(p.to).toBe(20);
  });
  it('요약 직후(미요약 < 임계)엔 다시 요약 안 함', () => {
    // summarizedCount=10, total=39 → 미요약 29 < 30
    expect(planSummarization(39, 10).shouldSummarize).toBe(false);
  });
});

describe('verbatimFrom', () => {
  it('summarizedCount 이후의 미요약 메시지 전체를 반환', () => {
    const msgs = Array.from({ length: 25 }, (_, i) => ({ role: 'user', content: String(i) }));
    expect(verbatimFrom(msgs, 10).length).toBe(15);
    expect(verbatimFrom(msgs, 10)[0].content).toBe('10');
  });
  it('상수값 확인', () => {
    expect(KEEP_MSGS).toBe(20);
    expect(BATCH_MSGS).toBe(10);
  });
});
