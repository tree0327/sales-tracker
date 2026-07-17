import { fmt } from '../utils/money';

function FlowRow({ mk, label, value, cls }) {
  return (
    <div className="fr">
      <span className="k"><span className={`mk ${mk}`}>{mk === 'in' ? '＋' : '−'}</span>{label}</span>
      <span className={`v num ${cls}`}>{value}</span>
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
export default function HomeScreen({ member, flow, monthLabel, onNav, onLogout }) {
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

        <MenuCard icon="⟳" iconCls="fx-ic" name="고정지출" amount={`−${fmt(flow.fixed)}원`} color="var(--expense)" onClick={() => onNav('expense', '고정')} />
        <MenuCard icon="−" iconCls="ex-ic" name="지출관리" amount={`−${fmt(flow.expense)}원`} color="var(--expense)" onClick={() => onNav('expense', 'joint')} />
        <MenuCard icon="＋" iconCls="in-ic" name="매출/급여관리" amount={`+${fmt(flow.income)}원`} color="var(--income)" onClick={() => onNav('income')} />
      </div>
    </div>
  );
}
