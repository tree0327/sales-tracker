import { createPortal } from 'react-dom';

// 파괴적 동작(삭제·로그아웃) 공용 확인 모달. 오버레이 클릭 = 취소.
export default function ConfirmDialog({ open, title, body, confirmLabel = '확인', danger = false, onConfirm, onCancel }) {
  if (!open) return null;
  return createPortal(
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title" className="modal-title">{title}</h2>
        {body && <p className="modal-body">{body}</p>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>취소</button>
          <button className={`btn-primary${danger ? ' btn-danger' : ''}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
