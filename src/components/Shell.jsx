import { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useSalesData } from '../hooks/useSalesData';
import { monthlyReport } from '../utils/analytics';
import {
  prevPeriodKey, isReportSeen, markReportSeen, shouldShowReport,
} from '../utils/monthlyReport';
import App from '../App.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import AiChat from './AiChat.jsx';
import MonthlyReportModal from './MonthlyReportModal.jsx';
import { GOAL_KEY } from '../utils/storageKeys';
import './Shell.css';

export default function Shell() {
  const [tab, setTab] = useState('input'); // 'input' | 'dashboard'
  const sales = useSalesData();
  const { salesData, loading } = sales;

  // 직전 정산월 리포트(데이터 로딩 완료 후에만 판정).
  const prevKey = useMemo(() => prevPeriodKey(new Date()), []);
  const report = useMemo(() => {
    if (loading) return null;
    return monthlyReport(salesData, new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  }, [salesData, loading]);

  const seen = isReportSeen(prevKey);
  const show = !loading && report && shouldShowReport({ hasPrevData: report.count > 0, isSeen: seen });
  const [dismissed, setDismissed] = useState(false);

  const closeReport = () => {
    markReportSeen(prevKey);
    setDismissed(true);
  };
  const goDashboardFromReport = () => {
    markReportSeen(prevKey);
    setDismissed(true);
    setTab('dashboard');
  };

  // 참고: 여기서 읽는 목표는 월별로 구분되지 않는 현재 목표값이며,
  // 지난달 달성률도 (단일 사용자 설계상 의도적으로) 이 현재 목표값 기준으로 계산된다.
  let goal = 0;
  try { goal = Number(window.localStorage.getItem(GOAL_KEY)) || 0; } catch { goal = 0; }

  return (
    <div className="shell">
      <div className="shell-tabs">
        <button
          className={`shell-tab ${tab === 'input' ? 'active' : ''}`}
          onClick={() => setTab('input')}
        >매출 입력</button>
        <button
          className={`shell-tab ${tab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setTab('dashboard')}
        >분석</button>
        <button
          className={`shell-tab ${tab === 'ai' ? 'active' : ''}`}
          onClick={() => setTab('ai')}
        >AI</button>
        <button className="shell-logout" onClick={() => supabase.auth.signOut()}>로그아웃</button>
      </div>

      <div className="shell-body">
        {tab === 'input' && <App sales={sales} />}
        {tab === 'dashboard' && <AdminDashboard salesData={sales.salesData} loading={sales.loading} />}
        {tab === 'ai' && <AiChat salesData={sales.salesData} dataLoading={sales.loading} />}
      </div>

      {show && !dismissed && (
        <MonthlyReportModal
          report={report}
          goal={goal}
          onClose={closeReport}
          onGoDashboard={goDashboardFromReport}
        />
      )}
    </div>
  );
}
