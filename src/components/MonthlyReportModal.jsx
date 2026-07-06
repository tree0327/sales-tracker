import { createPortal } from 'react-dom';
import './MonthlyReportModal.css';

const won = (n) => `${(Number(n) || 0).toLocaleString()}원`;

export default function MonthlyReportModal({ report, goal = 0, onClose, onGoDashboard }) {
  if (!report) return null;

  const [y, m] = report.ym.split('-');
  const title = `${y}년 ${Number(m)}월 매출 리포트`;
  const goalPct = goal ? Math.round((report.total / goal) * 100) : null;
  const mom = report.momRatePct;

  return createPortal(
    <div className="report-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="report-modal">
        <div className="report-head">
          <h2>{title}</h2>
          <button className="report-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="report-hero">
          <span className="report-hero-label">지난달 총매출</span>
          <strong className="report-hero-value">{won(report.total)}</strong>
          {mom !== null && (
            <span className={`report-mom ${mom > 0 ? 'up' : mom < 0 ? 'down' : ''}`}>
              전월 대비 {mom > 0 ? '▲' : mom < 0 ? '▼' : ''} {Math.abs(mom)}%
            </span>
          )}
        </div>

        <div className="report-grid">
          <div className="report-cell"><span>거래 건수</span><strong>{report.count}건</strong></div>
          <div className="report-cell"><span>건당 평균</span><strong>{won(report.avgPerTxn)}</strong></div>
          <div className="report-cell"><span>현금 {report.cashPct}%</span><strong>{won(report.cash)}</strong></div>
          <div className="report-cell"><span>카드 {report.cardPct}%</span><strong>{won(report.card)}</strong></div>
          <div className="report-cell"><span>카드 수수료</span><strong>{won(report.cardFee)}</strong></div>
          <div className="report-cell">
            <span>최고 매출일</span>
            <strong>{report.bestDay ? `${report.bestDay.day}일 (${won(report.bestDay.total)})` : '—'}</strong>
          </div>
        </div>

        {goalPct !== null && (
          <div className="report-goal">
            <div className="report-goal-row">
              <span>월 목표 달성률</span><strong>{goalPct}%</strong>
            </div>
            <div className="report-progress">
              <div className="report-progress-bar" style={{ width: `${Math.min(goalPct, 100)}%` }} />
            </div>
          </div>
        )}

        <div className="report-top">
          <h3>최고 거래 TOP 3</h3>
          <ul>
            {report.top3.map((r) => (
              <li key={r.id}><span>{r.name || r.type}</span><strong>{won(r.final)}</strong></li>
            ))}
            {report.top3.length === 0 && <li className="muted">거래 없음</li>}
          </ul>
        </div>

        <div className="report-actions">
          <button className="report-btn-secondary" onClick={onClose}>닫기</button>
          <button className="report-btn-primary" onClick={onGoDashboard}>대시보드에서 자세히 보기</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
