import { useState } from 'react';
import { getSalesPeriod, getPeriodEndDay } from './utils/salesPeriod';
import { todayTotal, thisWeekTotal } from './utils/analytics';
import InputModal from './components/InputModal';
import RecordModal from './components/RecordModal';
import './App.css';

function App({ sales }) {
  const { salesData, addRecord, updateRecord, deleteRecord, loading, error } = sales;

  const [modalState, setModalState] = useState({
    isOpen: false,
    type: '',
    isEdit: false,
    editId: null,
    initialData: null,
    seq: 0 // 열릴 때마다 증가 → InputModal key 로 사용해 입력값 초기화
  });

  const [recordModalState, setRecordModalState] = useState({
    isOpen: false,
    viewType: 'current' // 'current' or 'all'
  });

  // Calculate current month totals
  const period = getSalesPeriod();
  const currentData = salesData.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= period.start && itemDate < period.end;
  });

  const currentTotal = currentData.reduce((sum, item) => sum + item.final, 0);
  const currentCashTotal = currentData.filter(i => i.type === '현금').reduce((sum, i) => sum + i.final, 0);
  const currentCardTotal = currentData.filter(i => i.type === '카드').reduce((sum, i) => sum + i.final, 0);

  const now = new Date();
  const todaySales = todayTotal(salesData, now);
  const weekSales = thisWeekTotal(salesData, now);

  const formatPeriodDate = (date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Handlers for Input Modal
  const openInputModal = (type, isEdit = false, id = null, initialData = null) => {
    // If editing, close record modal first if it is open
    setRecordModalState(prev => ({ ...prev, isOpen: false }));
    setModalState(prev => ({ isOpen: true, type, isEdit, editId: id, initialData, seq: prev.seq + 1 }));
  };

  const closeInputModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleSaveSales = (type, amount, name, dateISO) => {
    if (modalState.isEdit) {
      updateRecord(modalState.editId, type, amount, name, dateISO);
    } else {
      addRecord(type, amount, name, dateISO);
    }
  };

  // Handlers for Record Modal
  const openRecordModal = (viewType) => {
    setRecordModalState({ isOpen: true, viewType });
  };

  const closeRecordModal = () => {
    setRecordModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleEditFromRecord = (type, id, originalAmount, name, dateISO) => {
    openInputModal(type, true, id, { original: originalAmount, name, date: dateISO });
  };

  return (
    <div className="app-container">
      {error && <div className="status-banner error">저장 중 문제가 발생했습니다: {error}</div>}
      {loading && <div className="status-banner info">동기화 중…</div>}

      <div className="main-buttons">
        <button 
          className="sq-btn cash-btn" 
          onClick={() => openInputModal('현금')}
        >
          <div className="btn-icon">&#xFFE6;</div>
          <span>현금</span>
        </button>
        <button 
          className="sq-btn card-btn" 
          onClick={() => openInputModal('카드')}
        >
          <div className="btn-icon-svg">
            <svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <span>카드</span>
        </button>
      </div>

      <div className="summary-cards">
        <div className="summary-card glass">
          <span className="summary-label">오늘 일매출</span>
          <span className="summary-value">{todaySales.toLocaleString()}<em>원</em></span>
        </div>
        <div className="summary-card glass">
          <span className="summary-label">이번 주 매출 <em>{weekSales.rangeLabel}</em></span>
          <span className="summary-value">{weekSales.total.toLocaleString()}<em>원</em></span>
        </div>
      </div>

      <div
        className="bottom-bar glass"
        onClick={() => openRecordModal('current')}
      >
        <span className="period-range">{formatPeriodDate(period.start)} ~ {formatPeriodDate(getPeriodEndDay(period.start))}</span>
        <span className="total-label">이번 달 누적 매출</span>
        <div className="total-amount-wrap">
          <span className="total-amount">{currentTotal.toLocaleString()}</span>
          <span className="total-unit">원</span>
        </div>
        <div className="sub-totals">
          <span className="sub-total-item cash-sub">현금 {currentCashTotal.toLocaleString()}원</span>
          <span className="sub-total-divider">|</span>
          <span className="sub-total-item card-sub">카드 {currentCardTotal.toLocaleString()}원</span>
        </div>
        <span className="click-hint">터치해서 기록 확인 및 수정</span>
      </div>

      <button className="btn-all-records-full" onClick={() => openRecordModal('all')}>
        전체 기록 보기
      </button>

      <InputModal
        key={modalState.seq}
        isOpen={modalState.isOpen}
        onClose={closeInputModal}
        onSave={handleSaveSales}
        initialType={modalState.type}
        initialData={modalState.initialData}
      />

      <RecordModal 
        isOpen={recordModalState.isOpen}
        onClose={closeRecordModal}
        viewType={recordModalState.viewType}
        salesData={salesData}
        onDelete={deleteRecord}
        onEdit={handleEditFromRecord}
      />
    </div>
  );
}

export default App;
