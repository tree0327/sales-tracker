import { useState } from 'react';
import { fmt } from '../utils/money';
import { resolveSheetDate, localYMD, buildRecordDateISO } from '../utils/recordDate';

const INC_CATS = ['급여', '기타수입'];
const WHO = [
  { key: 'wife', label: '아내', cls: 'w' },
  { key: 'joint', label: '공금', cls: 'j' },
  { key: 'husband', label: '남편', cls: 'h' },
];
const DATE_OPTS = ['오늘', '어제', '그저께'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'];

function buildTx(preset, role, editTx) {
  if (editTx) {
    return {
      flow: editTx.flow === 'expense' ? '지출' : '수입',
      amount: String(editTx.amount || ''),
      cat: editTx.category, who: editTx.owner, method: editTx.method,
      memo: editTx.memo || '', date: localYMD(editTx.date), whoAuto: false,
    };
  }
  const base = { flow: '지출', amount: '', cat: null, who: role, method: '카드', memo: '', date: '오늘', whoAuto: true };
  if (preset === '급여') Object.assign(base, { flow: '수입', cat: '급여', who: 'husband', method: '계좌', whoAuto: false });
  return base;
}

function Keypad({ onKey }) {
  return <div className="keypad">{KEYS.map((k) => <button key={k} className="key" onClick={() => onKey(k)}>{k}</button>)}</div>;
}
function Quick({ opts, onAdd }) {
  return <div className="quick">{opts.map(([lab, val]) => <button key={lab} onClick={() => onAdd(val)}>{lab}</button>)}</div>;
}
function Shell({ onClose, children }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        {children}
      </div>
    </>
  );
}

// 입력 시트. mode='tx'(거래) | 'fixed'(고정지출).
// 부모가 key={openKey} 로 리마운트시켜 매번 초기화한다.
export default function InputSheet({ mode, preset, categories, member, editTx = null, onClose, onSaveTx, onUpdateTx, onSaveFixed, onSaveTransfer, notify }) {
  const [tx, setTx] = useState(() => (mode === 'tx' ? buildTx(preset, member.role, editTx) : null));
  const [fx, setFx] = useState(() => (mode === 'fixed' ? { name: '', amount: '', method: '계좌' } : null));
  const [tr, setTr] = useState(() => (mode === 'transfer' ? { amount: '', who: member.role === 'joint' ? 'wife' : member.role, method: '계좌', memo: '', date: '오늘' } : null));

  const draft = mode === 'fixed' ? fx : mode === 'transfer' ? tr : tx;
  const amt = draft.amount ? parseInt(draft.amount, 10) : 0;
  const setAmount = (next) => {
    if (mode === 'fixed') setFx({ ...fx, amount: next });
    else if (mode === 'transfer') setTr({ ...tr, amount: next });
    else setTx({ ...tx, amount: next });
  };
  const pressKey = (k) => {
    let a = draft.amount;
    if (k === '⌫') a = a.slice(0, -1);
    else if (k === '00') a = a ? a + '00' : a;
    else a = a === '' && k === '0' ? '' : (a.length < 10 ? a + k : a);
    setAmount(a);
  };
  const addAmt = (d) => setAmount(String(amt + d));

  // ---- 고정지출 폼 ----
  if (mode === 'fixed') {
    const saveFixed = () => {
      if (!fx.name.trim()) return notify('이름을 입력해주세요');
      if (!amt) return notify('금액을 입력해주세요');
      onSaveFixed({ name: fx.name, amount: amt, day: 1, method: fx.method });
    };
    return (
      <Shell onClose={onClose}>
        <div className="field-lab" style={{ marginTop: 4 }}>고정지출 이름</div>
        <input className="memo-input" placeholder="예: 자동차 할부" value={fx.name} onChange={(e) => setFx({ ...fx, name: e.target.value })} />
        <div className="amt-disp"><div className={`big num ${amt ? '' : 'zero'}`}>{amt ? fmt(amt) : '0'}<span className="cur"> 원</span></div></div>
        <Quick opts={[['+10만', 100000], ['+30만', 300000], ['+50만', 500000], ['+100만', 1000000]]} onAdd={addAmt} />
        <div className="field-lab">결제수단</div>
        <div className="chips">{['계좌', '카드', '현금'].map((m) => (
          <button key={m} className={`chip ${fx.method === m ? 'on' : ''}`} onClick={() => setFx({ ...fx, method: m })}>{m}</button>
        ))}</div>
        <Keypad onKey={pressKey} />
        <button className="save" onClick={saveFixed}>고정지출 저장</button>
      </Shell>
    );
  }

  // ---- 공금 충전 폼 ----
  if (mode === 'transfer') {
    const isCustomTrDate = /^\d{4}-\d{2}-\d{2}$/.test(tr.date);
    const saveTr = () => {
      if (!amt) return notify('금액을 입력해주세요');
      onSaveTransfer({ amount: amt, who: tr.who, method: tr.method, memo: tr.memo, date: resolveSheetDate(tr.date) });
    };
    return (
      <Shell onClose={onClose}>
        <div className="field-lab" style={{ marginTop: 4 }}>공금 충전 · 누가 넣나요?</div>
        <div className="who">
          {[{ key: 'wife', label: '아내', cls: 'w' }, { key: 'husband', label: '남편', cls: 'h' }].map((w) => (
            <button key={w.key} className={`w2 ${tr.who === w.key ? 'on ' + w.cls : ''}`} onClick={() => setTr({ ...tr, who: w.key })}>{w.label}</button>
          ))}
        </div>
        <div className="amt-disp"><div className={`big num ${amt ? '' : 'zero'}`}>{amt ? fmt(amt) : '0'}<span className="cur"> 원</span></div></div>
        <Quick opts={[['+5만', 50000], ['+10만', 100000], ['+50만', 500000], ['+100만', 1000000]]} onAdd={addAmt} />
        <div className="field-lab">수단</div>
        <div className="chips">{['계좌', '현금', '카드'].map((m) => (
          <button key={m} className={`chip ${tr.method === m ? 'on' : ''}`} onClick={() => setTr({ ...tr, method: m })}>{m}</button>
        ))}</div>
        <div className="field-lab">날짜</div>
        <div className="chips">
          {DATE_OPTS.map((d) => (
            <button key={d} className={`chip ${tr.date === d ? 'on' : ''}`} onClick={() => setTr({ ...tr, date: d })}>{d}</button>
          ))}
          <button className={`chip ${isCustomTrDate ? 'on' : ''}`} onClick={() => setTr({ ...tr, date: localYMD(new Date()) })}>달력</button>
        </div>
        {isCustomTrDate && (
          <input type="date" className="memo-input" value={tr.date} max={localYMD(new Date())}
            onChange={(e) => setTr({ ...tr, date: e.target.value })} style={{ marginTop: 8 }} />
        )}
        <div className="field-lab">메모 (선택)</div>
        <input className="memo-input" placeholder="예: 이번 달 생활비 이체" value={tr.memo} onChange={(e) => setTr({ ...tr, memo: e.target.value })} />
        <Keypad onKey={pressKey} />
        <button className="save" onClick={saveTr}>공금 충전</button>
      </Shell>
    );
  }

  // ---- 거래 폼 ----
  const cats = draft.flow === '지출'
    ? categories.map((c) => c.name)
    : (INC_CATS.includes(draft.cat) || !draft.cat ? INC_CATS : [...INC_CATS, draft.cat]);
  const isSalary = draft.cat === '급여';
  const showMethod = !isSalary;
  const methodOpts = ['카드', '현금', '계좌'];
  const isCustomDate = /^\d{4}-\d{2}-\d{2}$/.test(draft.date);

  const setFlow = (flow) => {
    if (flow === '수입') setTx({ ...tx, flow, cat: '급여', who: 'husband', method: '계좌', whoAuto: false });
    else setTx({ ...tx, flow, cat: null, who: member.role, method: '카드', whoAuto: true });
  };
  const setCat = (cat) => {
    const next = { ...tx, cat };
    if (cat === '급여') { next.who = 'husband'; next.method = '계좌'; next.whoAuto = false; }
    setTx(next);
  };
  const save = () => {
    if (!amt) return notify('금액을 입력해주세요');
    if (!draft.cat) return notify('카테고리를 선택해주세요');
    const payload = {
      flow: draft.flow === '지출' ? 'expense' : 'income',
      amount: amt, category: draft.cat, owner: draft.who, method: draft.method, memo: draft.memo,
      // 수정: 원래 기록의 시각 보존(날짜만 교체). 신규: 칩/달력 → 현재 시각.
      date: editTx && /^\d{4}-\d{2}-\d{2}$/.test(draft.date)
        ? buildRecordDateISO(draft.date, editTx.date)
        : resolveSheetDate(draft.date),
    };
    if (editTx) onUpdateTx({ id: editTx.id, ...payload });
    else onSaveTx(payload);
  };

  return (
    <Shell onClose={onClose}>
      <div className="seg">
        <button className={`s ${draft.flow === '지출' ? 'on ex' : ''}`} onClick={() => setFlow('지출')}>지출</button>
        <button className={`s ${draft.flow === '수입' ? 'on in' : ''}`} onClick={() => setFlow('수입')}>수입</button>
      </div>
      <div className="amt-disp"><div className={`big num ${amt ? '' : 'zero'}`}>{amt ? fmt(amt) : '0'}<span className="cur"> 원</span></div></div>
      <Quick opts={[['+1만', 10000], ['+5만', 50000], ['+10만', 100000], ['+50만', 500000]]} onAdd={addAmt} />

      <div className="field-lab">카테고리</div>
      <div className="chips">{cats.map((c) => (
        <button key={c} className={`chip ${draft.cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
      ))}</div>

      {isSalary ? (
        <>
          <div className="field-lab">받는 사람</div>
          <span className="fixed-owner h">남편 급여 · 금액만 입력</span>
        </>
      ) : (
        <>
          <div className="field-lab">
            {draft.flow === '지출' ? '누구 지출?' : '누구 수입?'}
            {draft.whoAuto && <span className="auto">로그인 자동 · 탭해서 변경</span>}
          </div>
          <div className="who">{WHO.map((w) => (
            <button key={w.key} className={`w2 ${draft.who === w.key ? 'on ' + w.cls : ''}`}
              onClick={() => setTx({ ...tx, who: w.key, whoAuto: false })}>{w.label}</button>
          ))}</div>
        </>
      )}

      {showMethod && (
        <>
          <div className="field-lab">결제수단</div>
          <div className="chips">{methodOpts.map((m) => (
            <button key={m} className={`chip ${draft.method === m ? 'on' : ''}`} onClick={() => setTx({ ...tx, method: m })}>{m}</button>
          ))}</div>
        </>
      )}

      <div className="field-lab">날짜</div>
      <div className="chips">
        {DATE_OPTS.map((d) => (
          <button key={d} className={`chip ${draft.date === d ? 'on' : ''}`} onClick={() => setTx({ ...tx, date: d })}>{d}</button>
        ))}
        <button className={`chip ${isCustomDate ? 'on' : ''}`} onClick={() => setTx({ ...tx, date: localYMD(new Date()) })}>달력</button>
      </div>
      {isCustomDate && (
        <input type="date" className="memo-input" value={draft.date} max={localYMD(new Date())}
          onChange={(e) => setTx({ ...tx, date: e.target.value })} style={{ marginTop: 8 }} />
      )}

      <div className="field-lab">메모 (선택)</div>
      <input className="memo-input" placeholder="예: 성수 카페 데이트" value={draft.memo} onChange={(e) => setTx({ ...tx, memo: e.target.value })} />

      <Keypad onKey={pressKey} />
      <button className="save" onClick={save}>{editTx ? '수정 저장' : draft.flow === '지출' ? '지출 저장' : isSalary ? '급여 저장' : '수입 저장'}</button>
    </Shell>
  );
}
