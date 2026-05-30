function formatDateTime(isoString) {
  const dt = new Date(isoString);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')} ${String(
    dt.getHours()
  ).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

export default function RecordItem({ item, showActions = true, onEdit, onDelete }) {
  return (
    <div className="record-item">
      <div className="record-row">
        <div className="type-info">
          <span className={`type-badge ${item.type === '현금' ? 'cash' : 'card'}`}>{item.type}</span>
          {item.name && <span className="customer-name">{item.name}</span>}
        </div>
        <span className="final-amt">{item.final.toLocaleString()}원</span>
      </div>
      <div className="sub-row">
        <span>
          {formatDateTime(item.date)}
          {item.type === '카드' ? ` (원금: ${item.original.toLocaleString()}원, 수수료 10% 차감)` : ''}
        </span>
        {showActions && (
          <div className="action-btns">
            <button
              className="action-btn btn-edit"
              onClick={() => onEdit(item.type, item.id, item.original, item.name, item.date)}
            >
              수정
            </button>
            <button className="action-btn btn-delete" onClick={() => onDelete(item.id)}>
              삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
