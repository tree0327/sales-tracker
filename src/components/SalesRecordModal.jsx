import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getSalesPeriod } from '../utils/salesPeriod';
import { groupByMonth } from '../utils/analytics';

const won = (n) => `${(Number(n) || 0).toLocaleString()}원`;
const md = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };
const hm = (iso) => new Date(iso).toTimeString().slice(0, 5);

const FILTERS = ['전체', '현금', '카드'];
const applyFilter = (items, f) => (f === '전체' ? items : items.filter((r) => r.type === f));

// 결제수단 필터(전체/현금/카드) — 예전 매출앱 FilterButtons 포맷.
function FilterChips({ value, onChange }) {
  return (
    <div className="rec-filter" role="group" aria-label="결제수단 필터">
      {FILTERS.map((f) => (
        <button key={f} className={`rf ${value === f ? 'on' : ''}`} onClick={() => onChange(f)}>{f}</button>
      ))}
    </div>
  );
}

function RecRow({ r, onEdit, onAskDelete }) {
  return (
    <li className="rec-item">
      <div className="rec-main">
        <span className="rec-when num">{md(r.date)} {hm(r.date)}</span>
        <span className="rec-name">{r.name || '—'}</span>
        {/* 결제수단(현금/카드) 표시. .owner-badge 는 소유자 전용이라 별도 클래스(스타일 공유). */}
        <span className="method-badge">{r.type}</span>
      </div>
      <div className="rec-right">
        <span className="rec-amt num pos">{won(r.final)}</span>
        {r.type === '카드' && r.original !== r.final && (
          <span className="rec-org num">원금 {won(r.original)}</span>
        )}
      </div>
      <div className="rec-actions">
        <button className="btn-mini" onClick={() => onEdit(r)}>수정</button>
        <button className="btn-mini danger" onClick={() => onAskDelete(r.id)}>삭제</button>
      </div>
    </li>
  );
}

// 매출 기록 모달 — 예전 매출앱 RecordModal 포맷.
// current: 이번 달 목록 + 전체/현금/카드 필터. 헤더 건수·합계도 필터를 따라간다.
// all: 월별 아코디언(월 합계 + 현금/카드 소계) → 펼치면 그 달 전용 필터 + 거래 목록.
export default function SalesRecordModal({ isOpen, records, viewType, onClose, onEdit, onDelete }) {
  const [confirmId, setConfirmId] = useState(null);
  const [curFilter, setCurFilter] = useState('전체');
  const [openMonths, setOpenMonths] = useState({});     // { '2026-07': true }
  const [monthFilters, setMonthFilters] = useState({}); // { '2026-07': '카드' }
  if (!isOpen) return null;

  const toggleMonth = (key) => setOpenMonths((p) => ({ ...p, [key]: !p[key] }));
  const setMonthFilter = (key, f) => setMonthFilters((p) => ({ ...p, [key]: f }));

  let body, headCount, headTotal;

  if (viewType === 'current') {
    const period = getSalesPeriod();
    const inMonth = records
      .filter((r) => { const t = new Date(r.date); return t >= period.start && t < period.end; })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const list = applyFilter(inMonth, curFilter);
    headCount = list.length;
    headTotal = list.reduce((s, r) => s + (Number(r.final) || 0), 0);

    body = (
      <>
        <FilterChips value={curFilter} onChange={setCurFilter} />
        {list.length === 0 && <p className="empty">해당 기록이 없어요.</p>}
        <ul className="rec-list">
          {list.map((r) => <RecRow key={r.id} r={r} onEdit={onEdit} onAskDelete={setConfirmId} />)}
        </ul>
      </>
    );
  } else {
    const groups = groupByMonth(records); // 최신 달 우선. 각 그룹: { key, label, total, cash, card, items }
    headCount = records.length;
    headTotal = records.reduce((s, r) => s + (Number(r.final) || 0), 0);

    body = groups.length === 0 ? <p className="empty">아직 매출 기록이 없어요.</p> : groups.map((g) => {
      const open = !!openMonths[g.key];
      const f = monthFilters[g.key] || '전체';
      const list = applyFilter(g.items, f);
      return (
        <div key={g.key} className="macc">
          <button className="macc-head" aria-expanded={open} onClick={() => toggleMonth(g.key)}>
            <span className="macc-chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
            <span className="macc-title">{g.label}</span>
            <span className="macc-right">
              <b className="num">{won(g.total)}</b>
              <span className="macc-sub num">현금 {g.cash.toLocaleString()} · 카드 {g.card.toLocaleString()}</span>
            </span>
          </button>
          {open && (
            <div className="macc-panel">
              <FilterChips value={f} onChange={(v) => setMonthFilter(g.key, v)} />
              {list.length === 0 && <p className="empty">해당 결제수단 기록이 없어요.</p>}
              <ul className="rec-list">
                {list.map((r) => <RecRow key={r.id} r={r} onEdit={onEdit} onAskDelete={setConfirmId} />)}
              </ul>
            </div>
          )}
        </div>
      );
    });
  }

  return createPortal(
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card sales-records" role="dialog" aria-modal="true" aria-labelledby="sales-rec-title"
        onClick={(e) => e.stopPropagation()}>
        <h2 id="sales-rec-title" className="modal-title">
          {viewType === 'current' ? '이번 달 매출 기록' : '전체 매출 기록'}
          <span className="modal-sub">{headCount}건 · {won(headTotal)}</span>
        </h2>

        {body}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
        </div>

        {confirmId !== null && (
          <div className="modal-scrim" onClick={() => setConfirmId(null)}>
            <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="del-title"
              onClick={(e) => e.stopPropagation()}>
              <h2 id="del-title" className="modal-title">기록을 삭제할까요?</h2>
              <p className="modal-body">되돌릴 수 없습니다.</p>
              <div className="modal-actions">
                <button className="btn-ghost" onClick={() => setConfirmId(null)}>취소</button>
                <button className="btn-primary" onClick={() => { onDelete(confirmId); setConfirmId(null); }}>삭제</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
