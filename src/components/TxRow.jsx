import OwnerBadge from './OwnerBadge';
import { fmt } from '../utils/money';

function dayLabel(date) {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 거래 1건 행. 소유자 뱃지 + 제목(메모||카테고리) + 결제수단/날짜 + 금액.
// onEdit 이 있으면 행 본문(× 삭제 버튼 제외) 탭으로 수정 시트를 연다.
export default function TxRow({ tx, onDelete, onEdit, showCategory = true }) {
  const isIncome = tx.flow === 'income';
  const amount = isIncome ? (tx.final ?? tx.amount) : tx.amount;
  const cardSalonNote = isIncome && tx.category === '매출' && tx.method === '카드' ? ` · 원금 ${fmt(tx.amount)}` : '';
  const title = tx.memo || tx.category;

  return (
    <div className={`tx${onEdit ? ' tappable' : ''}`} onClick={onEdit ? () => onEdit(tx) : undefined}
      role={onEdit ? 'button' : undefined} tabIndex={onEdit ? 0 : undefined}
      onKeyDown={onEdit ? (e) => { if (e.key === 'Enter') onEdit(tx); } : undefined}>
      <OwnerBadge owner={tx.owner} />
      <div className="mid">
        <div className="cat">
          {title}
          {tx.memo && showCategory && (
            <span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 500 }}> · {tx.category}</span>
          )}
        </div>
        <div className="meta"><span className="pill">{tx.method}</span> {dayLabel(tx.date)}{cardSalonNote}</div>
      </div>
      <div className={`amt num ${isIncome ? 'pos' : 'calm'}`}>
        {isIncome ? '+' : '−'}{fmt(amount)}
      </div>
      {onDelete && <button className="del" aria-label="삭제" onClick={(e) => { e.stopPropagation(); onDelete(tx.id); }}>×</button>}
    </div>
  );
}
