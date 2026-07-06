import { useState } from 'react';
import { monthlyReport } from '../utils/analytics';
import { callAI } from '../utils/aiClient';
import { buildReportPayload, buildChatContext, detectAnomalies } from '../utils/aiPayload';
import './AiInsights.css';

export default function AiInsights({ salesData }) {
  const now = new Date();
  const [report, setReport] = useState({ loading: false, text: '', error: '' });
  const [anomaly, setAnomaly] = useState({ loading: false, text: '', error: '' });

  const anomalies = detectAnomalies(salesData, now);

  const runReport = async () => {
    setReport({ loading: true, text: '', error: '' });
    try {
      const payload = buildReportPayload(monthlyReport(salesData, now));
      const text = await callAI('report', payload);
      setReport({ loading: false, text, error: '' });
    } catch (e) {
      setReport({ loading: false, text: '', error: e.message });
    }
  };

  const runAnomaly = async () => {
    setAnomaly({ loading: true, text: '', error: '' });
    try {
      const text = await callAI('anomaly', { 이상치: anomalies, 요약: buildChatContext(salesData, now) });
      setAnomaly({ loading: false, text, error: '' });
    } catch (e) {
      setAnomaly({ loading: false, text: '', error: e.message });
    }
  };

  return (
    <>
      <div className="admin-section ai-section">
        <h2>AI 매출 분석</h2>
        <button className="ai-btn" onClick={runReport} disabled={report.loading}>
          {report.loading ? '분석 중…' : '이번 달 AI 분석 생성'}
        </button>
        {report.error && <p className="ai-error">{report.error}</p>}
        {report.text && <div className="ai-result">{report.text}</div>}
      </div>

      <div className="admin-section ai-section">
        <h2>이상치 감지</h2>
        {anomalies.length === 0 ? (
          <p className="muted">특이 사항이 감지되지 않았습니다.</p>
        ) : (
          <>
            <ul className="ai-anomaly-list">
              {anomalies.map((a, i) => (
                <li key={i}><strong>{a.유형}</strong> — {a.상세}</li>
              ))}
            </ul>
            <button className="ai-btn" onClick={runAnomaly} disabled={anomaly.loading}>
              {anomaly.loading ? '분석 중…' : 'AI 원인 분석'}
            </button>
            {anomaly.error && <p className="ai-error">{anomaly.error}</p>}
            {anomaly.text && <div className="ai-result">{anomaly.text}</div>}
          </>
        )}
      </div>
    </>
  );
}
