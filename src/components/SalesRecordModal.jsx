import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getSalesPeriod } from '../utils/salesPeriod';

const won = (n) => `${(Number(n) || 0).toLocaleString()}원`;
const md = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };
const hm = (iso) => new Date(iso).toTimeString().slice(0, 5);

// 매출 기록 목록. 이번 달(current) 또는 전체(all).
export default function SalesRecordModal({ isOpen, records, viewType, onClose, onEdit, onDelete }) {
  const [confirmId, setConfirmId] = useState(null);
  if (!isOpen) return null;

  const period = getSalesPeriod();
  const list = (viewType === 'current'
    ? records.filter((r) => { const t = new Date(r.date); return t >= period.start && t < period.end; })
    : records
  ).slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  const total = list.reduce((s, r) => s + (Number(r.final) || 0), 0);

  return createPortal(
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card sales-records" role="dialog" aria-modal="true" aria-labelledby="sales-rec-title"
        onClick={(e) => e.stopPropagation()}>
        <h2 id="sales-rec-title" className="modal-title">
          {viewType === 'current' ? '이번 달 매출 기록' : '전체 매출 기록'}
          <span className="modal-sub">{list.length}건 · {won(total)}</span>
        </h2>

        {list.length === 0 && <p className="empty">아직 매출 기록이 없어요.</p>}

        <ul className="rec-list">
          {list.map((r) => (
            <li key={r.id} className="rec-item">
              <div className="rec-main">
                <span className="rec-when num">{md(r.date)} {hm(r.date)}</span>
                <span className="rec-name">{r.name || '—'}</span>
                {/* 결제수단(현금/카드) 표시. .owner-badge 는 소유자(아내/남편/공금) 전용이라 별도 클래스를 쓴다(스타일은 공유). */}
                <span className="method-badge">{r.type}</span>
              </div>
              <div className="rec-right">
                <span className="rec-amt num pos">{won(r.final)}</span>
                {r.type === '카드' && r.original !== r.final && (
                  <span className="rec-org num">원금 {won(r.original)}</span>
                )}
              </div>
              <div className="rec-actions">
                <button className="btn-mini" onClick={() => onEdit(r)}>수정</button>
                <button className="btn-mini danger" onClick={() => setConfirmId(r.id)}>삭제</button>
              </div>
            </li>
          ))}
        </ul>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
        </div>

        {confirmId !== null && (
          <div className="modal-scrim" onClick={() => setConfirmId(null)}>
            <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="del-title"
              onClick={(e) => e.stopPropagation()}>
              <h2 id="del-title" className="modal-title">기록을 삭제할까요?</h2>
              <p className="modal-body">되돌릴 수 없습니다.</p>
              <div className="modal-actions">
                <button className="btn-ghost" onClick={() => setConfirmId(null)}>취소</button>
                <button className="btn-primary" onClick={() => { onDelete(confirmId); setConfirmId(null); }}>삭제</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
