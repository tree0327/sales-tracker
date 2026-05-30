import { useModal } from '../context/ModalContext';
import { getSalesPeriod, getPeriodKey } from '../utils/salesPeriod';
import { useState } from 'react';
import './RecordModal.css';

export default function RecordModal({ isOpen, onClose, viewType, salesData, onDelete, onEdit }) {
  const [openPanels, setOpenPanels] = useState({});
  const [panelFilters, setPanelFilters] = useState({}); // per-panel filter: '전체' | '현금' | '카드'
  const [currentFilter, setCurrentFilter] = useState('전체'); // filter for current month view
  const { showConfirm } = useModal();

  if (!isOpen) return null;

  const period = getSalesPeriod();

  const togglePanel = (key) => {
    setOpenPanels(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const setPanelFilter = (key, filter) => {
    setPanelFilters(prev => ({
      ...prev,
      [key]: filter
    }));
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm('삭제 확인', '이 기록을 삭제하시겠습니까?');
    if (confirmed) {
      onDelete(id);
    }
  };

  const formatDateTime = (isoString) => {
    const dt = new Date(isoString);
    return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  };

  const FilterButtons = ({ activeFilter, onFilterChange }) => (
    <div className="filter-buttons">
      {['전체', '현금', '카드'].map(f => (
        <button
          key={f}
          className={`filter-btn ${activeFilter === f ? 'active' : ''} ${f === '현금' ? 'cash-filter' : f === '카드' ? 'card-filter' : ''}`}
          onClick={e => { e.stopPropagation(); onFilterChange(f); }}
        >
          {f}
        </button>
      ))}
    </div>
  );

  const RecordItem = ({ item, showActions = true }) => (
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
            <button className="action-btn btn-edit" onClick={() => onEdit(item.type, item.id, item.original, item.name)}>수정</button>
            <button className="action-btn btn-delete" onClick={() => handleDelete(item.id)}>삭제</button>
          </div>
        )}
      </div>
    </div>
  );

  let content;

  if (viewType === 'current') {
    const currentData = salesData.filter(item => {
      const dt = new Date(item.date);
      return dt >= period.start && dt < period.end;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const filteredData = currentFilter === '전체' ? currentData : currentData.filter(item => item.type === currentFilter);

    content = (
      <>
        <FilterButtons activeFilter={currentFilter} onFilterChange={setCurrentFilter} />
        {filteredData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">--</div>
            <div>기록이 없습니다.</div>
          </div>
        ) : (
          filteredData.map(item => <RecordItem key={item.id} item={item} showActions={true} />)
        )}
      </>
    );
  } else {
    // all view
    if (salesData.length === 0) {
      content = (
        <div className="empty-state">
          <div className="empty-icon">--</div>
          <div>기록이 없습니다.</div>
        </div>
      );
    } else {
      const groups = {};
      salesData.forEach(item => {
        const key = getPeriodKey(item.date);
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });

      const sortedKeys = Object.keys(groups).sort().reverse();
      
      content = sortedKeys.map((key, index) => {
        const monthIndex = sortedKeys.length - index;
        const periodItems = groups[key].sort((a, b) => new Date(b.date) - new Date(a.date));
        const periodTotal = periodItems.reduce((sum, item) => sum + item.final, 0);
        const cashTotal = periodItems.filter(i => i.type === '현금').reduce((sum, i) => sum + i.final, 0);
        const cardTotal = periodItems.filter(i => i.type === '카드').reduce((sum, i) => sum + i.final, 0);
        const [year, month] = key.split('-');
        
        const panelFilter = panelFilters[key] || '전체';
        const filteredItems = panelFilter === '전체' ? periodItems : periodItems.filter(item => item.type === panelFilter);

        return (
          <div key={key} className="accordion-group">
            <button className="accordion" onClick={() => togglePanel(key)}>
              <div className="accordion-title">
                <span className="month-badge">{monthIndex}개월차</span>
                <span className="period-label">{year}년 {parseInt(month)}월 주기</span>
              </div>
              <div className="accordion-right">
                <span className="accordion-total">{periodTotal.toLocaleString()}원</span>
                <div className="accordion-sub-totals">
                  <span className="accordion-cash">현금 {cashTotal.toLocaleString()}</span>
                  <span className="accordion-divider">/</span>
                  <span className="accordion-card">카드 {cardTotal.toLocaleString()}</span>
                </div>
              </div>
            </button>
            
            {openPanels[key] && (
              <div className="panel slide-down">
                <FilterButtons activeFilter={panelFilter} onFilterChange={(f) => setPanelFilter(key, f)} />
                {filteredItems.length === 0 ? (
                  <div className="empty-state small">
                    <div>해당 결제 수단의 기록이 없습니다.</div>
                  </div>
                ) : (
                  filteredItems.map(item => <RecordItem key={item.id} item={item} showActions={true} />)
                )}
              </div>
            )}
          </div>
        );
      });
    }
  }

  return (
    <div className="modal-backdrop record-modal-backdrop" onClick={onClose}>
      <div className="modal-content record-modal-content glass" onClick={e => e.stopPropagation()}>
        <h3>{viewType === 'current' ? '이번 달 상세 기록' : '전체 매출 기록'}</h3>
        
        <div className="record-list">
          {content}
        </div>
        
        <div className="btn-group">
          <button className="btn-close" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
