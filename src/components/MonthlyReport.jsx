import { fmt } from '../utils/money';

// 새 달 첫 접속 시 뜨는 지난달 요약 리포트.
export default function MonthlyReport({ report, onClose, onSeeAnalysis }) {
  const { label, income, expense, salon, topCats } = report;
  const net = income - expense;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="m-emoji">📊</div>
        <h3>지난달 {label} 리포트</h3>

        <div className="report-row"><span>수입</span><b className="pos num">+{fmt(income)}원</b></div>
        <div className="report-row"><span>지출</span><b className="num">−{fmt(expense)}원</b></div>
        {salon > 0 && <div className="report-row"><span>미용실 매출</span><b className="num" style={{ color: 'var(--wife)' }}>{fmt(salon)}원</b></div>}
        <div className="report-row total">
          <span>수입 − 지출</span>
          <b className={`num ${net >= 0 ? 'pos' : 'neg'}`}>{net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}원</b>
        </div>

        {topCats.length > 0 && (
          <div className="report-cats">
            <div className="rc-t">가장 많이 쓴 곳</div>
            {topCats.map((c) => (
              <div className="rc" key={c.name}><span>{c.name}</span><span className="num">{fmt(c.amount)}원</span></div>
            ))}
          </div>
        )}

        <button className="save" onClick={onSeeAnalysis}>분석 자세히 보기</button>
        <button className="ghost" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
