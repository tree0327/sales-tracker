import { useState } from 'react';
import { fmt } from '../utils/money';
import { isSameMonth, signedAmount, groupByDay } from '../utils/ledger';
import TxRow from '../components/TxRow';
import AnalysisView from './AnalysisView';

const TODAY_KEY = (() => { const d = new Date(); return `${d.getMonth() + 1}/${d.getDate()}`; })();
const dayLabel = (k) => (k === TODAY_KEY ? `오늘 · ${k}` : k);

// 기록: 월 이동 + 필터(종류·소유자·결제수단) + 월별/일별
export default function RecordsScreen({ transactions, budgets, onDelete }) {
  const now = new Date();
  const [mode, setMode] = useState('기록');       // 기록 | 분석
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [type, setType] = useState('전체');       // 전체 | income | expense
  const [person, setPerson] = useState('전체');   // 전체 | wife | husband | joint
  const [method, setMethod] = useState('전체');   // 전체 | 카드 | 현금 | 계좌
  const [gran, setGran] = useState('월별');        // 월별 | 일별
  const [day, setDay] = useState(null);

  const year = now.getFullYear();
  const shiftMonth = (dir) => { let m = month + dir; if (m < 1) m = 12; if (m > 12) m = 1; setMonth(m); setDay(null); };

  const filtered = transactions.filter((t) =>
    t.flow !== 'transfer' &&
    isSameMonth(t, month, year) &&
    (type === '전체' || t.flow === type) &&
    (person === '전체' || t.owner === person) &&
    (method === '전체' || t.method === method)
  );
  const incT = filtered.filter((t) => t.flow === 'income').reduce((a, t) => a + Number(t.final ?? t.amount), 0);
  const expT = filtered.filter((t) => t.flow === 'expense').reduce((a, t) => a + Number(t.amount), 0);

  const groups = groupByDay(filtered);
  const dayKeys = groups.map((g) => g.day);
  const activeDay = day && dayKeys.includes(day) ? day : dayKeys[0];

  const TYPES = [['전체', '전체'], ['수입', 'income'], ['지출', 'expense']];
  const PERSONS = [['전체', '전체', ''], ['아내', 'wife', 'w'], ['남편', 'husband', 'h'], ['공금', 'joint', 'j']];
  const METHODS = ['전체', '카드', '현금', '계좌'];

  return (
    <div>
      <header className="app-head">
        <span className="mnav">
          <button onClick={() => shiftMonth(-1)}>‹</button>
          {year}.{month < 10 ? '0' : ''}{month}
          <button onClick={() => shiftMonth(1)}>›</button>
        </span>
      </header>
      <div className="body">
        <div className="seg">
          <button className={`s ${mode === '기록' ? 'on' : ''}`} onClick={() => setMode('기록')}>기록</button>
          <button className={`s ${mode === '분석' ? 'on' : ''}`} onClick={() => setMode('분석')}>분석</button>
        </div>

        {mode === '분석' ? (
          <AnalysisView transactions={transactions} month={month} year={year} budgets={budgets} />
        ) : (
        <>
        <div className="seg" style={{ marginTop: 8 }}>
          {TYPES.map(([label, val]) => (
            <button key={val} className={`s ${type === val ? 'on' : ''}`} onClick={() => { setType(val); setDay(null); }}>{label}</button>
          ))}
        </div>

        <div className="filterbar" style={{ marginTop: 8 }}>
          <div className="fchips">
            {PERSONS.map(([label, val]) => (
              <button key={val} className={`fchip ${person === val ? 'on' : ''}`} onClick={() => { setPerson(val); setDay(null); }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="filterbar">
          <div className="fchips">
            {METHODS.map((m) => (
              <button key={m} className={`fchip ${method === m ? 'on' : ''}`} onClick={() => { setMethod(m); setDay(null); }}>{m}</button>
            ))}
          </div>
          <div className="gran">
            {['월별', '일별'].map((g) => (
              <button key={g} className={`g ${gran === g ? 'on' : ''}`} onClick={() => setGran(g)}>{g}</button>
            ))}
          </div>
        </div>

        <div className="mini-hero">
          <div>
            <div className="k">{month}월 기록 <span style={{ color: 'var(--fg-3)' }}>· {filtered.length}건</span></div>
            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 14, fontWeight: 700 }}>
              <span className="pos">수입 {fmt(incT)}</span>
              <span className="calm">지출 {fmt(expT)}</span>
            </div>
          </div>
        </div>

        {filtered.length === 0 && <div className="empty">이 달엔 조건에 맞는 기록이 없어요.</div>}

        {gran === '일별' && activeDay && (
          <div className="filterbar" style={{ marginTop: 14 }}>
            <div className="fchips">
              {dayKeys.map((k) => (
                <button key={k} className={`fchip ${k === activeDay ? 'on' : ''}`} onClick={() => setDay(k)}>{dayLabel(k)}</button>
              ))}
            </div>
          </div>
        )}

        {gran === '일별'
          ? (activeDay && <DayGroup group={groups.find((g) => g.day === activeDay)} onDelete={onDelete} />)
          : groups.map((g) => <DayGroup key={g.day} group={g} onDelete={onDelete} />)}
        </>
        )}
      </div>
    </div>
  );
}

function DayGroup({ group, onDelete }) {
  if (!group) return null;
  const net = group.items.reduce((a, t) => a + signedAmount(t), 0);
  return (
    <>
      <div className="sec-title" style={{ marginTop: 16 }}>
        {dayLabel(group.day)}
        <span className="r num" style={{ color: net >= 0 ? 'var(--ok-fg)' : 'var(--fg-3)' }}>{net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}</span>
      </div>
      {group.items.map((t) => <TxRow key={t.id} tx={t} onDelete={onDelete} />)}
    </>
  );
}
