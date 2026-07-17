import { fmt } from '../utils/money';

function FlowRow({ mk, label, value, cls }) {
  return (
    <div className="fr">
      <span className="k"><span className={`mk ${mk}`}>{mk === 'in' ? '＋' : '−'}</span>{label}</span>
      <span className={`v num ${cls}`}>{value}</span>
    </div>
  );
}

function BudgetGauge({ used, budget }) {
  const ratio = used / budget;
  const pct = Math.round(ratio * 100);
  const over = used > budget;
  const near = !over && ratio >= 0.8;
  const color = over ? 'var(--expense)' : near ? 'var(--brand)' : 'var(--income)';
  return (
    <div className="central" style={{ marginTop: 11, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="cap">이번 달 예산</span>
        <span className="num" style={{ fontWeight: 800, color }}>{pct}%</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 13, fontWeight: 700 }}>
        <span className="num">{fmt(used)}원 사용</span>
        <span className="num" style={{ color: 'var(--ink-3)' }}>/ {fmt(budget)}원</span>
      </div>
      <div style={{ height: 9, marginTop: 10, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
        <i style={{ display: 'block', height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 999 }} />
      </div>
      {over && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: 'var(--expense)' }}>예산을 {fmt(used - budget)}원 초과했어요</div>}
      {near && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: 'var(--brand-ink)' }}>예산의 {pct}%를 썼어요</div>}
    </div>
  );
}

function MenuCard({ icon, iconCls, name, amount, color, onClick }) {
  return (
    <button className="menu-card" onClick={onClick}>
      <span className="name"><span className={`ic ${iconCls}`}>{icon}</span>{name}</span>
      <span className="amt num" style={{ color }}>{amount}<span className="arrow">›</span></span>
    </button>
  );
}

// 홈: 현재 잔액(랜딩) + 흐름 계산 + 대메뉴
export default function HomeScreen({ member, flow, monthLabel, overallBudget, onNav, onLogout }) {
  const b = flow.balance;
  return (
    <div>
      <header className="app-head">
        <span className="title">{monthLabel}<span className="chev">▾</span></span>
        <span className="hd-r">
          <button className="icn" onClick={() => onNav('settings')}>⚙</button>
          <button className={`userchip ${member.cls}`} onClick={onLogout} title="탭하면 로그아웃">
            <span className="av">{member.init}</span>{member.name}
          </button>
        </span>
      </header>
      <div className="body">
        <div className="central">
          <div className="cap">이번 달 우리 가계 잔액</div>
          <div className={`bal num ${b >= 0 ? 'pos' : 'neg'}`}>{b >= 0 ? '+' : ''}{fmt(b)}<span className="won">원</span></div>
          <div className="hint">매달 고정지출부터 빼고 시작해요</div>
          <div className="flow">
            <FlowRow mk="fx" label="고정지출 (시작점)" value={`−${fmt(flow.fixed)}`} cls="neg" />
            <FlowRow mk="in" label="매출 · 급여" value={`+${fmt(flow.income)}`} cls="pos" />
            <FlowRow mk="va" label="변동지출" value={`−${fmt(flow.expense)}`} cls="calm" />
            <div className="fr total">
              <span className="k">현재 잔액</span>
              <span className={`v num ${b >= 0 ? 'pos' : 'neg'}`}>{b >= 0 ? '+' : ''}{fmt(b)}</span>
            </div>
          </div>
        </div>

        {overallBudget > 0 && <BudgetGauge used={flow.expense} budget={overallBudget} />}

        <MenuCard icon="⟳" iconCls="fx-ic" name="고정지출" amount={`−${fmt(flow.fixed)}원`} color="var(--expense)" onClick={() => onNav('expense', '고정')} />
        <MenuCard icon="−" iconCls="ex-ic" name="지출관리" amount={`−${fmt(flow.expense)}원`} color="var(--expense)" onClick={() => onNav('expense', 'joint')} />
        <MenuCard icon="＋" iconCls="in-ic" name="매출/급여관리" amount={`+${fmt(flow.income)}원`} color="var(--income)" onClick={() => onNav('income')} />
      </div>
    </div>
  );
}
