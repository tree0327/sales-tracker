import { useMemo, useState } from 'react';
import { salesRecords } from '../utils/salesAdapter';
import { todayTotal, thisWeekTotal } from '../utils/analytics';
import { getSalesPeriod, getPeriodEndDay } from '../utils/salesPeriod';
import SalesInputModal from '../components/SalesInputModal';
import SalesRecordModal from '../components/SalesRecordModal';

const won = (n) => (Number(n) || 0).toLocaleString();
const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

// 매출관리 — 예전 미용실앱 '입력' 화면 포맷.
// 데이터는 transactions(flow=income, category=매출)에 그대로 저장되어 가계부 잔액에 반영된다.
export default function SalesScreen({ transactions, onAdd, onUpdate, onDelete }) {
  const records = useMemo(() => salesRecords(transactions), [transactions]);
  const [input, setInput] = useState(null);   // { type, initialData } | null
  const [recView, setRecView] = useState(null); // 'current' | 'all' | null
  const [seq, setSeq] = useState(0);

  const now = new Date();
  const period = getSalesPeriod();
  const inPeriod = records.filter((r) => { const t = new Date(r.date); return t >= period.start && t < period.end; });
  const monthTotal = inPeriod.reduce((s, r) => s + r.final, 0);
  const monthCash = inPeriod.filter((r) => r.type === '현금').reduce((s, r) => s + r.final, 0);
  const monthCard = inPeriod.filter((r) => r.type === '카드').reduce((s, r) => s + r.final, 0);
  const today = todayTotal(records, now);
  const week = thisWeekTotal(records, now);

  const openNew = (type) => { setSeq((k) => k + 1); setInput({ type, initialData: null }); };
  const openEdit = (rec) => { setRecView(null); setSeq((k) => k + 1); setInput({ type: rec.type, initialData: rec }); };

  const save = (type, amount, name, dateISO) => {
    if (input?.initialData) onUpdate({ id: input.initialData.id, method: type, amount, memo: name, date: dateISO });
    else onAdd({ method: type, amount, memo: name, date: dateISO });
  };

  return (
    <div>
      <header className="app-head sales-head"><span className="title">매출관리</span></header>
      <div className="body">
        <div className="sales-buttons">
          <button className="sq-btn fill" onClick={() => openNew('현금')}>
            <span className="sq-icon" aria-hidden="true">￦</span>
            <span>현금</span>
          </button>
          <button className="sq-btn" onClick={() => openNew('카드')}>
            <span className="sq-icon" aria-hidden="true">▭</span>
            <span>카드</span>
          </button>
        </div>

        <div className="sales-summary">
          <div className="sum-card">
            <span className="sum-label">오늘 일매출</span>
            <span className="sum-value num">{won(today)}<em>원</em></span>
          </div>
          <div className="sum-card">
            <span className="sum-label">이번 주 매출 <em>{week.rangeLabel}</em></span>
            <span className="sum-value num">{won(week.total)}<em>원</em></span>
          </div>
        </div>

        <button className="sales-total" onClick={() => setRecView('current')}>
          <span className="st-period num">{md(period.start)} ~ {md(getPeriodEndDay(period.start))}</span>
          <span className="st-label">이번 달 누적 매출</span>
          <span className="st-amount num">{won(monthTotal)}<em>원</em></span>
          <span className="st-subs num">현금 {won(monthCash)}원 · 카드 {won(monthCard)}원</span>
          <span className="st-hint">터치해서 기록 확인 및 수정</span>
        </button>

        <button className="add-row" onClick={() => setRecView('all')}>전체 기록 보기</button>
      </div>

      <SalesInputModal key={seq} isOpen={!!input} type={input?.type} initialData={input?.initialData}
        onClose={() => setInput(null)} onSave={save} />

      <SalesRecordModal isOpen={!!recView} records={records} viewType={recView}
        onClose={() => setRecView(null)} onEdit={openEdit} onDelete={onDelete} />
    </div>
  );
}
