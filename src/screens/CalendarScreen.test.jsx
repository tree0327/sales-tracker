import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CalendarScreen from './CalendarScreen';

const now = new Date();
const Y = now.getFullYear(), M = now.getMonth() + 1;
const last = new Date(Y, M, 0).getDate();
const at = (d, h = 12) => new Date(Y, M - 1, Math.min(d, last), h).toISOString();
const OTHER = now.getDate() === 3 ? 4 : 3;

const CATS = [{ id: 1, name: '식비' }, { id: 2, name: '생활' }];
const TX = [
  { id: 1, flow: 'expense', category: '식비', owner: 'wife', method: '카드', amount: 30000, date: at(OTHER) },
  { id: 2, flow: 'expense', category: '생활', owner: 'joint', method: '카드', amount: 200000, date: at(now.getDate()) },
  { id: 3, flow: 'income', category: '매출', owner: 'wife', method: '카드', amount: 150000, final: 150000, date: at(now.getDate()) },
];

const render = (tx = TX) => renderToStaticMarkup(
  <CalendarScreen transactions={tx} categories={CATS} onAddExpense={() => {}} onDeleteExpense={() => {}} />
);

describe('CalendarScreen', () => {
  it('달력과 이번 달 총 지출만 렌더한다 (섹션이 늘어나지 않게 고정)', () => {
    const html = render();
    expect(html).toContain('cal-grid');
    expect(html).toContain(`${M}월 총 지출`);
    expect(html).toContain('230,000'); // 지출만 합산 — 매출 150,000 은 제외
    expect(html).toContain('2건');
    // 삭제한 기능들이 되살아나지 않았는지
    expect(html).not.toContain('하루 권장');
    expect(html).not.toContain('카테고리 예산');
    expect(html).not.toContain('계획');
    expect(html).not.toContain('pace-card');
  });

  it('지출이 있는 날 칸만 강조되고 금액이 붙는다', () => {
    const html = render();
    expect(html).toMatch(new RegExp(`cal-cell spent[^>]*aria-label="${M}월 ${OTHER}일 지출 30,000원 — 눌러서 등록"`));
    expect(html).toContain('3만');
    expect(html).toContain('20만');
  });

  it('오늘 칸에 today 표식이 붙는다', () => {
    expect(render()).toMatch(new RegExp(`cal-cell[^"]*today"[^>]*aria-label="${M}월 ${now.getDate()}일`));
  });

  it('지출이 없어도 깨지지 않고 0원으로 뜬다', () => {
    const html = render([]);
    expect(html).toContain('cal-grid');
    expect(html).toContain('0건');
  });
});
