import { useState, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { resolveMember } from './lib/members';
import { useLedger } from './hooks/useLedger';
import { monthlyFlow, isSameMonth, budgetMap, OVERALL, byCategory, sumFinal, sumAmount, incomeList, expenseList } from './utils/ledger';
import HomeScreen from './screens/HomeScreen';
import ExpenseScreen from './screens/ExpenseScreen';
import IncomeScreen from './screens/IncomeScreen';
import RecordsScreen from './screens/RecordsScreen';
import SettingsScreen from './screens/SettingsScreen';
import TabBar from './components/TabBar';
import InputSheet from './components/InputSheet';
import MonthlyReport from './components/MonthlyReport';

const MONTH_LABEL = (() => { const d = new Date(); return `${d.getFullYear()}년 ${d.getMonth() + 1}월`; })();

// 로그인 후 메인 앱 셸.
export default function Ledger({ user }) {
  const member = resolveMember(user);
  const ledger = useLedger();
  const { transactions, fixed, categories, budgets, loading, error, needsSetup } = ledger;

  const now = new Date();
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lmMonth = lm.getMonth() + 1;
  const lmYear = lm.getFullYear();
  const reportKey = `report_seen_${lmYear}_${lmMonth}`;

  const [tab, setTab] = useState('home');
  const [reportClosed, setReportClosed] = useState(() => {
    try { return !!window.localStorage.getItem(reportKey); } catch { return true; }
  });
  const [expenseTab, setExpenseTab] = useState('고정');
  const [incomeKind, setIncomeKind] = useState('매출');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState('tx');   // 'tx' | 'fixed'
  const [sheetPreset, setSheetPreset] = useState(null);
  const [openKey, setOpenKey] = useState(0);

  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1700);
  }, []);

  const onNav = (view, opt) => {
    if (view === 'expense' && opt) setExpenseTab(opt);
    setTab(view);
    window.scrollTo(0, 0);
  };
  const openInput = (preset = null) => { setSheetMode('tx'); setSheetPreset(preset); setOpenKey((k) => k + 1); setSheetOpen(true); };
  const openFixed = () => { setSheetMode('fixed'); setSheetPreset(null); setOpenKey((k) => k + 1); setSheetOpen(true); };
  const closeSheet = () => setSheetOpen(false);

  const saveTx = async (payload) => {
    const row = await ledger.addTransaction(payload);
    closeSheet();
    if (row) {
      notify(`${payload.flow === 'expense' ? '지출' : payload.category === '급여' ? '급여' : payload.category === '매출' ? '매출' : '수입'} 저장!`);
      setTab('home');
    }
  };
  const saveFixed = async (payload) => {
    const row = await ledger.addFixed(payload);
    closeSheet();
    if (row) { notify('고정지출 저장!'); setExpenseTab('고정'); setTab('expense'); }
  };
  const logout = () => supabase.auth.signOut();

  const closeReport = () => {
    try { window.localStorage.setItem(reportKey, '1'); } catch { /* ignore */ }
    setReportClosed(true);
  };
  const seeReportAnalysis = () => { closeReport(); setTab('records'); };

  // '이번 달' 화면용: 현재 월 거래만
  const monthTx = transactions.filter((t) => isSameMonth(t, now.getMonth() + 1, now.getFullYear()));
  const flow = monthlyFlow(monthTx, fixed);
  const bmap = budgetMap(budgets);
  const overallBudget = bmap[OVERALL] || 0;

  // 지난달 리포트(새 달 첫 접속 · 지난달 데이터 있을 때 1회)
  const lmTx = transactions.filter((t) => isSameMonth(t, lmMonth, lmYear));
  const showReport = !loading && !needsSetup && !reportClosed && lmTx.length > 0;
  const report = showReport ? {
    label: `${lmMonth}월`,
    income: sumFinal(incomeList(lmTx)),
    expense: sumAmount(expenseList(lmTx)),
    salon: sumFinal(lmTx.filter((t) => t.flow === 'income' && t.category === '매출')),
    topCats: byCategory(expenseList(lmTx)).slice(0, 3),
  } : null;

  if (needsSetup) {
    return (
      <div className="app">
        <div className="setup">
          <div style={{ fontSize: 34 }}>🛠️</div>
          <h2>데이터베이스 설정이 필요해요</h2>
          <p>
            Supabase SQL Editor에서 <code>supabase/migrations/0006_household_ledger.sql</code>을 실행한 뒤
            새로고침하세요. 테이블(<code>transactions</code> 등)이 아직 없습니다.
          </p>
          <button className="set-logout" style={{ maxWidth: 200, margin: '20px auto 0' }} onClick={logout}>로그아웃</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`app${sheetOpen ? ' sheet-open' : ''}`}>
      {error && <div className="status-banner error">문제가 발생했습니다: {error}</div>}
      {loading && <div className="status-banner info">동기화 중…</div>}

      {tab === 'home' && <HomeScreen member={member} flow={flow} monthLabel={MONTH_LABEL} overallBudget={overallBudget} onNav={onNav} onLogout={logout} />}
      {tab === 'expense' && (
        <ExpenseScreen transactions={monthTx} fixed={fixed} activeTab={expenseTab} onTab={setExpenseTab}
          onNav={onNav} onAddFixed={openFixed} onDeleteFixed={ledger.deleteFixed} />
      )}
      {tab === 'income' && <IncomeScreen transactions={monthTx} kind={incomeKind} onKind={setIncomeKind} onAddIncome={openInput} />}
      {tab === 'records' && <RecordsScreen transactions={transactions} budgets={bmap} onDelete={ledger.deleteTransaction} />}
      {tab === 'settings' && (
        <SettingsScreen categories={categories} budgets={bmap} member={member} onNav={onNav}
          onSetBudget={ledger.setBudget} onAddCategory={ledger.addCategory} onDeleteCategory={ledger.deleteCategory} onLogout={logout} />
      )}

      <TabBar tab={tab} onNav={onNav} onAdd={() => openInput(null)} />

      {report && <MonthlyReport report={report} onClose={closeReport} onSeeAnalysis={seeReportAnalysis} />}

      <InputSheet key={openKey} mode={sheetMode} preset={sheetPreset}
        categories={categories} member={member} onClose={closeSheet} onSaveTx={saveTx} onSaveFixed={saveFixed} notify={notify} />

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  );
}
