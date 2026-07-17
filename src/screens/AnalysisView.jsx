import { fmt } from '../utils/money';
import { byCategory, isSameMonth, monthlyTrend } from '../utils/ledger';

// 가벼운 세로 막대 그래프(외부 라이브러리 없음).
function VBars({ data, series, height = 150 }) {
  const W = 340, H = height, padBottom = 26, padX = 10, padTop = 12;
  const n = data.length || 1;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.k])));
  const groupW = (W - padX * 2) / n;
  const barW = Math.max(8, Math.min(16, (groupW - 10) / series.length));
  const chartH = H - padTop - padBottom;
  const y0 = H - padBottom;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img">
      <line x1={padX} y1={y0} x2={W - padX} y2={y0} stroke="var(--line)" strokeWidth="1" />
      {data.map((d, i) => {
        const gx = padX + groupW * i + groupW / 2;
        const totalW = series.length * barW + (series.length - 1) * 3;
        return (
          <g key={i}>
            {series.map((s, j) => {
              const h = Math.round((d[s.k] / max) * chartH);
              const bx = gx - totalW / 2 + j * (barW + 3);
              return <rect key={s.k} x={bx} y={y0 - h} width={barW} height={h} rx="3" fill={s.color} />;
            })}
            <text x={gx} y={y0 + 16} textAnchor="middle" fontSize="11" fill="var(--fg-3)" fontWeight="500">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Legend({ items }) {
  return (
    <div className="ratio-legend" style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--fg-2)', fontWeight: 500, marginTop: 4 }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color, display: 'inline-block' }} />{it.label}
        </span>
      ))}
    </div>
  );
}

// 기록 탭 안 '분석' 뷰. 기록의 월(month/year)을 공유한다.
export default function AnalysisView({ transactions, month, year, budgets }) {
  const monthExpenses = transactions.filter((t) => t.flow === 'expense' && isSameMonth(t, month, year));
  const cats = byCategory(monthExpenses);
  const maxCat = cats.length ? cats[0].amount : 1;

  const trend = monthlyTrend(transactions, new Date(year, month - 1, 1), 6);
  const hasSalon = trend.some((t) => t.salon > 0);

  return (
    <div>
      <div className="sec-title" style={{ marginTop: 16 }}>{month}월 카테고리별 지출 <span className="r">{cats.length}개</span></div>
      {cats.length === 0 && <div className="empty">이 달 지출 내역이 없어요.</div>}
      <div className="catbars">
        {cats.map((c) => {
          const budget = budgets[c.name] || 0;
          const ratio = budget ? c.amount / budget : c.amount / maxCat;
          const over = budget && c.amount > budget;
          const color = over ? 'var(--err-fg)' : 'var(--fg)';
          return (
            <div className="cbar" key={c.name}>
              <div className="cb-top">
                <span>{c.name}</span>
                <b className="num">{fmt(c.amount)}원{budget ? <span style={{ color: 'var(--fg-3)', fontWeight: 500 }}> / {fmt(budget)}</span> : null}</b>
              </div>
              <div className="track"><i style={{ width: `${Math.min(100, Math.round(ratio * 100))}%`, background: color }} /></div>
            </div>
          );
        })}
      </div>

      <div className="sec-title" style={{ marginTop: 22 }}>최근 6개월 수입·지출</div>
      <div className="mini-hero" style={{ display: 'block', padding: '16px 12px 8px' }}>
        <VBars data={trend} series={[{ k: 'income', color: 'var(--ok-fg)' }, { k: 'expense', color: 'var(--err-fg)' }]} />
        <Legend items={[{ label: '수입', color: 'var(--ok-fg)' }, { label: '지출', color: 'var(--err-fg)' }]} />
      </div>

      {hasSalon && (
        <>
          <div className="sec-title" style={{ marginTop: 22 }}>미용실 매출 추이 <span className="r">최근 6개월</span></div>
          <div className="mini-hero" style={{ display: 'block', padding: '16px 12px 8px' }}>
            <VBars data={trend} series={[{ k: 'salon', color: 'var(--ok-fg)' }]} height={130} />
            <Legend items={[{ label: '미용실 매출', color: 'var(--ok-fg)' }]} />
          </div>
        </>
      )}
    </div>
  );
}
