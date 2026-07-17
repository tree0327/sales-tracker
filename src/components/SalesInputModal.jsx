import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CARD_FEE_RATE, cardFinal } from '../utils/money';
import { buildRecordDateISO } from '../utils/recordDate';

// 매출 입력/수정. 부모가 열 때마다 key 를 바꿔 리마운트하므로 초기값은 useState 초기화로 한 번만 계산한다.
export default function SalesInputModal({ isOpen, type, initialData, onClose, onSave }) {
  const [amount, setAmount] = useState(initialData ? String(initialData.original || '') : '');
  const [name, setName] = useState(initialData?.name || '');
  const [date, setDate] = useState(
    initialData?.date ? initialData.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [err, setErr] = useState('');

  if (!isOpen) return null;

  const display = amount ? Number(amount).toLocaleString() : '';

  const onAmount = (e) => {
    setAmount(e.target.value.replace(/,/g, '').replace(/[^0-9]/g, ''));
    setErr('');
  };

  const save = () => {
    if (!amount || Number(amount) <= 0) { setErr('금액을 입력해주세요.'); return; }
    // 신규는 현재 시각, 수정은 원래 기록의 시각을 보존하고 날짜만 바꾼다.
    onSave(type, Number(amount), name, buildRecordDateISO(date, initialData?.date ?? null));
    onClose();
  };

  return createPortal(
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="sales-input-title"
        onClick={(e) => e.stopPropagation()}>
        <h2 id="sales-input-title" className="modal-title">{type} 매출 {initialData ? '수정' : '입력'}</h2>

        <label className="field">
          <span className="field-label">날짜</span>
          <input type="date" value={date} max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">고객명 / 메모 (선택)</span>
          <input type="text" placeholder="예: 홍길동, VIP" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">금액 (필수)</span>
          <input type="text" inputMode="numeric" placeholder="0" value={display} onChange={onAmount} autoFocus />
        </label>

        {type === '카드' && Number(amount) > 0 && (
          <p className="field-hint">
            수수료 {CARD_FEE_RATE * 100}% 차감 후 실수령{' '}
            <b className="num">{cardFinal(Number(amount)).toLocaleString()}원</b>
          </p>
        )}

        {err && <p className="msg err" role="alert">{err}</p>}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={save}>저장</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
