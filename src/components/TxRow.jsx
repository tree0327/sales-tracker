import OwnerBadge from './OwnerBadge';
import { fmt } from '../utils/money';

function dayLabel(date) {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 거래 1건 행. 소유자 뱃지 + 제목(메모||카테고리) + 결제수단/날짜 + 금액.
export default function TxRow({ tx, onDelete, showCategory = true }) {
  const isIncome = tx.flow === 'income';
  const amount = isIncome ? (tx.final ?? tx.amount) : tx.amount;
  const cardSalonNote = isIncome && tx.category === '매출' && tx.method === '카드' ? ` · 원금 ${fmt(tx.amount)}` : '';
  const title = tx.memo || tx.category;

  return (
    <div className="tx">
      <OwnerBadge owner={tx.owner} />
      <div className="mid">
        <div className="cat">
          {title}
          {tx.memo && showCategory && (
            <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}> · {tx.category}</span>
          )}
        </div>
        <div className="meta"><span className="pill">{tx.method}</span> {dayLabel(tx.date)}{cardSalonNote}</div>
      </div>
      <div className="amt num" style={{ color: isIncome ? 'var(--income)' : 'var(--ink)' }}>
        {isIncome ? '+' : '−'}{fmt(amount)}
      </div>
      {onDelete && <button className="del" aria-label="삭제" onClick={() => onDelete(tx.id)}>×</button>}
    </div>
  );
}
