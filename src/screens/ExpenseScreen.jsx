import { MEMBERS } from '../lib/members';
import { fmt } from '../utils/money';
import { expenseByOwner, byCategory, fixedTotal, sumAmount } from '../utils/ledger';
import TxRow from '../components/TxRow';

const TABS = [
  { key: '고정', label: '고정', cls: 'fx' },
  { key: 'wife', label: '아내', cls: 'w' },
  { key: 'husband', label: '남편', cls: 'h' },
  { key: 'joint', label: '공금', cls: 'j' },
];

function dayLabel(date) {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function DepositRow({ d }) {
  const m = MEMBERS[d.owner] || MEMBERS.wife;
  return (
    <div className="tx">
      <div className={`ava ${m.cls}`}>{m.init}</div>
      <div className="mid"><div className="cat">공금 충전{d.memo ? ` · ${d.memo}` : ''}</div><div className="meta"><span className="pill">{d.method}</span> {dayLabel(d.date)}</div></div>
      <div className="amt num pos">+{fmt(d.amount)}</div>
    </div>
  );
}

function JointBody({ transactions, jointStat, deposits, onDeposit }) {
  const recent = deposits.slice(0, 5);
  return (
    <>
      <div className="mini-hero">
        <div>
          <div className="k">공금 잔고</div>
          <div className={`v num ${jointStat.balance >= 0 ? 'calm' : 'neg'}`}>{fmt(jointStat.balance)}<span style={{ fontSize: 15, color: 'var(--fg-2)' }}>원</span></div>
        </div>
        <div className="r">아내 넣음 <b className="num">{fmt(jointStat.contrib.wife)}</b><br />남편 넣음 <b className="num">{fmt(jointStat.contrib.husband)}</b></div>
      </div>
      <button className="add-row" onClick={onDeposit}>＋ 공금 충전</button>
      {recent.length > 0 && (
        <>
          <div className="sec-title">최근 충전 <span className="r">{deposits.length}건</span></div>
          {recent.map((d) => <DepositRow key={d.id} d={d} />)}
        </>
      )}
      <PersonBody transactions={transactions} owner="joint" />
    </>
  );
}

function FixedBody({ fixed, onAddFixed, onDeleteFixed }) {
  return (
    <>
      <div className="mini-hero">
        <div>
          <div className="k"><span className="mk fx" style={{ width: 20, height: 20, borderRadius: 'var(--r-sm)', fontSize: 12 }}>−</span>매달 고정지출 합계</div>
          <div className="v neg num">−{fmt(fixedTotal(fixed))}<span style={{ fontSize: 15, color: 'var(--fg-2)' }}>원</span></div>
        </div>
        <div className="r">매월 1일<br /><b>자동 반영</b></div>
      </div>
      <div className="sec-title">등록된 고정지출 <span className="r">{fixed.length}건</span></div>
      {fixed.length === 0 && <div className="empty">등록된 고정지출이 없어요.<br />아래에서 추가해보세요.</div>}
      {fixed.map((f) => (
        <div className="tx" key={f.id}>
          <div className="ava fx">{f.name.slice(0, 1)}</div>
          <div className="mid"><div className="cat">{f.name}</div><div className="meta">매월 {f.day}일 · {f.method}</div></div>
          <div className="amt num calm">−{fmt(f.amount)}</div>
          <button className="del" aria-label="삭제" onClick={() => onDeleteFixed(f.id)}>×</button>
        </div>
      ))}
      <button className="add-row" onClick={onAddFixed}>＋ 고정지출 추가</button>
    </>
  );
}

function PersonBody({ transactions, owner }) {
  const list = expenseByOwner(transactions, owner);
  const tot = sumAmount(list);
  const m = MEMBERS[owner];
  const cats = byCategory(list);
  const max = cats.length ? cats[0].amount : 1;
  const barColor = 'var(--fg)'; // 막대 길이가 이미 크기를 표현하므로 소유자별 색 구분 없이 단색
  return (
    <>
      <div className="mini-hero">
        <div>
          <div className="k">{m.name} · 이번 달 사용</div>
          <div className="v num">{fmt(tot)}<span style={{ fontSize: 15, color: 'var(--fg-2)' }}>원</span></div>
        </div>
        <div className="r">변동지출<br /><b>합계</b></div>
      </div>
      {cats.length > 0 && (
        <>
          <div className="sec-title">어디에 썼나 (카테고리)</div>
          <div className="catbars">
            {cats.map((c) => (
              <div className="cbar" key={c.name}>
                <div className="cb-top"><span>{c.name}</span><b className="num">{fmt(c.amount)}원</b></div>
                <div className="track"><i style={{ width: `${Math.round(c.amount / max * 100)}%`, background: barColor }} /></div>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="sec-title">최근 내역 <span className="r">{list.length}건</span></div>
      {list.length === 0 && <div className="empty">아직 내역이 없어요.<br />＋ 버튼으로 지출을 입력해보세요.</div>}
      {list.map((t) => <TxRow key={t.id} tx={t} />)}
    </>
  );
}

// 지출관리: 고정 · 아내 · 남편 · 공금(통장)
export default function ExpenseScreen({ transactions, fixed, activeTab, onTab, onNav, onAddFixed, onDeleteFixed, jointStat, deposits, onDeposit }) {
  return (
    <div>
      <header className="app-head">
        <span className="title">지출관리</span>
        <button className="icn" onClick={() => onNav('settings')}>⚙</button>
      </header>
      <div className="body">
        <div className="seg">
          {TABS.map((t) => (
            <button key={t.key} className={`s ${t.key === activeTab ? 'on ' + t.cls : ''}`} onClick={() => onTab(t.key)}>{t.label}</button>
          ))}
        </div>
        {activeTab === '고정' ? (
          <FixedBody fixed={fixed} onAddFixed={onAddFixed} onDeleteFixed={onDeleteFixed} />
        ) : activeTab === 'joint' ? (
          <JointBody transactions={transactions} jointStat={jointStat} deposits={deposits} onDeposit={onDeposit} />
        ) : (
          <PersonBody transactions={transactions} owner={activeTab} />
        )}
      </div>
    </div>
  );
}
