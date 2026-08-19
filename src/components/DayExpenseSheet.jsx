import { useState } from 'react';
import { createPortal } from 'react-dom';
import { fmt } from '../utils/money';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const digits = (v) => String(v ?? '').replace(/[^0-9]/g, '');

// 날짜를 누르면 뜨는 지출 등록 팝업.
// 금액 + 카테고리 + 메모만 받고, 소유자·결제수단은 기본값으로 채운다(입력 마찰 최소화).
export default function DayExpenseSheet({ isOpen, year, month, day, categories = [], items = [], onClose, onSubmit, onDelete }) {
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState(categories[0]?.name || '기타');
  const [memo, setMemo] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const dow = WEEK[new Date(year, month - 1, day).getDay()];
  const dayTotal = items.reduce((a, t) => a + (Number(t.amount) || 0), 0);

  const submit = async () => {
    if (busy) return;
    if (!amount || Number(amount) <= 0) { setErr('금액을 입력해주세요.'); return; }
    setBusy(true);
    await onSubmit({ amount: Number(amount), category: cat, memo });
    setBusy(false);
    // 팝업을 닫지 않고 비운다 — 같은 날 여러 건을 이어서 넣는 게 흔한 패턴이라
    // 매번 날짜를 다시 누르게 만들지 않는다.
    setAmount('');
    setMemo('');
    setErr('');
  };

  return createPortal(
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card day-sheet" role="dialog" aria-modal="true" aria-labelledby="day-exp-title"
        onClick={(e) => e.stopPropagation()}>
        <h2 id="day-exp-title" className="modal-title">{month}월 {day}일 ({dow}) 지출</h2>

        <div className="amt-field">
          <input type="text" inputMode="numeric" placeholder="0" autoFocus className="num"
            value={amount ? Number(amount).toLocaleString() : ''}
            onChange={(e) => { setAmount(digits(e.target.value)); setErr(''); }} />
          <span>원</span>
        </div>

        <div className="chips" role="group" aria-label="카테고리">
          {(categories.length ? categories : [{ id: 0, name: '기타' }]).map((c) => (
            <button key={c.id} type="button" className={`chip${cat === c.name ? ' on' : ''}`}
              onClick={() => setCat(c.name)}>{c.name}</button>
          ))}
        </div>

        <input type="text" className="memo-input" placeholder="메모 (선택)" maxLength={40}
          value={memo} onChange={(e) => setMemo(e.target.value)} />

        {err && <p className="msg err" role="alert">{err}</p>}

        {items.length > 0 && (
          <div className="day-list">
            <div className="day-list-head">
              이날 등록된 지출 <b className="num">{fmt(dayTotal)}원</b>
            </div>
            {items.map((t) => (
              <div className="day-item" key={t.id}>
                <span className="di-cat">{t.category}{t.memo ? ` · ${t.memo}` : ''}</span>
                <span className="di-amt num">{fmt(t.amount)}</span>
                <button className="di-del" aria-label={`${t.category} ${fmt(t.amount)}원 삭제`}
                  onClick={() => onDelete(t.id)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '저장 중…' : '확인'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
