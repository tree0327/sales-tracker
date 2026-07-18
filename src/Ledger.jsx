import { useState, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { resolveMember } from './lib/members';
import { useLedger } from './hooks/useLedger';
import { monthlyFlow, isSameMonth, budgetMap, OVERALL, byCategory, sumFinal, sumAmount, incomeList, expenseList, jointBalance, jointContributions, jointDeposits } from './utils/ledger';
import HomeScreen from './screens/HomeScreen';
import ExpenseScreen from './screens/ExpenseScreen';
import SalesScreen from './screens/SalesScreen';
import IncomeScreen from './screens/IncomeScreen';
import RecordsScreen from './screens/RecordsScreen';
import SettingsScreen from './screens/SettingsScreen';
import TabBar from './components/TabBar';
import InputSheet from './components/InputSheet';
import MonthlyReport from './components/MonthlyReport';
import ConfirmDialog from './components/ConfirmDialog';
import SalesInputModal from './components/SalesInputModal';

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
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // 거래 id | null
  const [undoTx, setUndoTx] = useState(null); // 삭제 직후 실행취소용 스냅샷
  const [expenseTab, setExpenseTab] = useState('고정');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState('tx');   // 'tx' | 'fixed'
  const [sheetPreset, setSheetPreset] = useState(null);
  const [openKey, setOpenKey] = useState(0);
  const [editTx, setEditTx] = useState(null);         // 기록 탭 행 탭 → 수정 모드 대상 거래
  const [salesEdit, setSalesEdit] = useState(null);    // 기록 탭에서 매출 행 수정 시(전용 모달)

  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const notify = useCallback((msg) => {
    setUndoTx(null); // 새 알림이 뜨면 직전 삭제의 실행취소 기회는 닫는다(버튼이 엉뚱한 메시지에 붙는 것 방지)
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1700);
  }, []);

  const onNav = (view, opt) => {
    if (view === 'expense' && opt) setExpenseTab(opt);
    setTab(view);
    window.scrollTo(0, 0);
  };
  const openInput = (preset = null) => { setSheetMode('tx'); setSheetPreset(preset); setEditTx(null); setOpenKey((k) => k + 1); setSheetOpen(true); };
  const openFixed = () => { setSheetMode('fixed'); setSheetPreset(null); setEditTx(null); setOpenKey((k) => k + 1); setSheetOpen(true); };
  const openTransfer = () => { setSheetMode('transfer'); setSheetPreset(null); setEditTx(null); setOpenKey((k) => k + 1); setSheetOpen(true); };
  const closeSheet = () => setSheetOpen(false);
  // 기록 탭 행 탭 → 수정 진입. 매출은 수수료 로직이 있는 전용 모달로 라우팅.
  const openEditTx = (t) => {
    if (t.flow === 'income' && t.category === '매출') {
      setSalesEdit({ id: t.id, original: t.amount, name: t.memo || '', date: t.date, type: t.method });
      return;
    }
    setSheetMode('tx'); setSheetPreset(null); setEditTx(t); setOpenKey((k) => k + 1); setSheetOpen(true);
  };

  const saveTx = async (payload) => {
    const row = await ledger.addTransaction(payload);
    closeSheet();
    if (row) {
      notify(`${payload.flow === 'expense' ? '지출' : payload.category === '급여' ? '급여' : '수입'} 저장!`);
    }
  };
  const saveFixed = async (payload) => {
    const row = await ledger.addFixed(payload);
    closeSheet();
    if (row) { notify('고정지출 저장!'); setExpenseTab('고정'); setTab('expense'); }
  };
  const saveTransfer = async (payload) => {
    const row = await ledger.addTransaction({
      flow: 'transfer', category: '공금충전', owner: payload.who,
      method: payload.method, amount: payload.amount, memo: payload.memo, date: payload.date,
    });
    closeSheet();
    if (row) { notify('공금 충전 완료!'); setExpenseTab('joint'); setTab('expense'); }
  };
  // 매출 탭 전용. 매출은 항상 아내 소유 · income/매출 로 저장된다.
  const addSales = async ({ method, amount, memo, date }) => {
    const row = await ledger.addTransaction({ flow: 'income', category: '매출', owner: 'wife', method, amount, memo, date });
    if (row) notify('매출 저장!');
  };
  const updateSales = async ({ id, method, amount, memo, date }) => {
    const row = await ledger.updateTransaction({ id, flow: 'income', category: '매출', method, amount, memo, date });
    if (row) notify('매출 수정!');
  };
  // 기록 탭 행 탭 → 수정 저장(지출·급여·기타수입). 매출은 openEditTx 에서 SalesInputModal 로 분기됨.
  const updateTx = async (payload) => {
    const row = await ledger.updateTransaction(payload);
    closeSheet(); setEditTx(null);
    if (row) notify('수정했어요');
  };
  const askDeleteTx = (id) => setConfirmDelete(id);
  const doDeleteTx = async () => {
    const id = confirmDelete;
    setConfirmDelete(null);
    const removed = await ledger.deleteTransaction(id);
    if (removed) {
      setUndoTx(removed);
      clearTimeout(toastTimer.current);
      setToast('삭제했어요');
      toastTimer.current = setTimeout(() => { setToast(''); setUndoTx(null); }, 6000);
    }
  };
  const undoDelete = async () => {
    const t = undoTx;
    setUndoTx(null); setToast('');
    if (t) await ledger.addTransaction({ flow: t.flow, amount: t.amount, category: t.category, owner: t.owner, method: t.method, memo: t.memo, date: t.date });
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
  const jointStat = { ...jointBalance(transactions), contrib: jointContributions(transactions) };
  const deposits = jointDeposits(transactions);

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

      {tab === 'home' && <HomeScreen member={member} flow={flow} monthLabel={MONTH_LABEL} overallBudget={overallBudget} jointBalance={jointStat.balance} onNav={onNav} onLogout={() => setConfirmLogout(true)} />}
      {tab === 'expense' && (
        <ExpenseScreen transactions={monthTx} fixed={fixed} activeTab={expenseTab} onTab={setExpenseTab}
          onNav={onNav} onAddFixed={openFixed} onDeleteFixed={ledger.deleteFixed}
          jointStat={jointStat} deposits={deposits} onDeposit={openTransfer} />
      )}
      {tab === 'sales' && (
        <SalesScreen transactions={transactions} onAdd={addSales} onUpdate={updateSales} onDelete={askDeleteTx} />
      )}
      {tab === 'income' && <IncomeScreen transactions={monthTx} onAddIncome={openInput} />}
      {tab === 'records' && <RecordsScreen transactions={transactions} budgets={bmap} onDelete={askDeleteTx} onEdit={openEditTx} />}
      {tab === 'settings' && (
        <SettingsScreen categories={categories} budgets={bmap} member={member} onNav={onNav}
          onSetBudget={ledger.setBudget} onAddCategory={ledger.addCategory} onDeleteCategory={ledger.deleteCategory} onLogout={() => setConfirmLogout(true)} />
      )}

      <TabBar tab={tab} onNav={onNav} onAdd={() => openInput(null)} />

      {report && <MonthlyReport report={report} onClose={closeReport} onSeeAnalysis={seeReportAnalysis} />}

      <InputSheet key={openKey} mode={sheetMode} preset={sheetPreset}
        categories={categories} member={member} editTx={editTx} onClose={closeSheet}
        onSaveTx={saveTx} onUpdateTx={updateTx} onSaveFixed={saveFixed} onSaveTransfer={saveTransfer} notify={notify} />

      {salesEdit && (
        <SalesInputModal key={`rec-edit-${salesEdit.id}`} isOpen type={salesEdit.type}
          initialData={salesEdit} onClose={() => setSalesEdit(null)}
          onSave={(type, amount, name, dateISO) => updateSales({ id: salesEdit.id, method: type, amount, memo: name, date: dateISO })} />
      )}

      <ConfirmDialog open={confirmLogout} title="로그아웃할까요?" confirmLabel="로그아웃"
        onConfirm={() => { setConfirmLogout(false); logout(); }} onCancel={() => setConfirmLogout(false)} />

      <ConfirmDialog open={confirmDelete !== null} title="기록을 삭제할까요?" body="삭제 직후 실행취소할 수 있어요."
        confirmLabel="삭제" danger onConfirm={doDeleteTx} onCancel={() => setConfirmDelete(null)} />

      <div className={`toast${toast ? ' show' : ''}`}>
        {toast}
        {undoTx && <button className="toast-undo" onClick={undoDelete}>실행취소</button>}
      </div>
    </div>
  );
}
