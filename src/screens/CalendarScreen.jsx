import { useState } from 'react';
import { fmt } from '../utils/money';
import { calendarGrid, dailySpend, monthSummary, dayExpenses } from '../utils/calendar';
import { localYMD, buildRecordDateISO } from '../utils/recordDate';
import DayExpenseSheet from '../components/DayExpenseSheet';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

// 칸 안엔 자릿수가 길면 안 들어간다. 만 단위로 줄인다.
const short = (n) => {
  const v = Math.round(Number(n) || 0);
  if (v === 0) return '';
  if (v < 10000) return `${Math.round(v / 1000)}천`;
  const man = v / 10000;
  return `${man >= 100 ? Math.round(man) : Math.round(man * 10) / 10}만`;
};

// 캘린더 — 날짜를 누르면 그날 지출을 바로 등록한다. 아래엔 이번 달 총 지출.
export default function CalendarScreen({ transactions, categories = [], onAddExpense, onDeleteExpense }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [sel, setSel] = useState(null); // 팝업 대상 날짜(일) | null

  const shift = (dir) => {
    const d = new Date(year, month - 1 + dir, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const grid = calendarGrid(year, month);
  const spendBy = dailySpend(transactions, year, month);
  const sum = monthSummary(transactions, year, month, now);
  const isThisMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const selItems = sel ? dayExpenses(transactions, year, month, sel) : [];

  // 선택한 날짜 + 지금 시각으로 저장한다. 로컬 기준이라 심야 입력에도 날짜가 밀리지 않는다.
  const submit = ({ amount, category, memo }) =>
    onAddExpense({ amount, category, memo, date: buildRecordDateISO(localYMD(new Date(year, month - 1, sel))) });

  return (
    <div>
      <header className="app-head">
        <span className="mnav">
          <button onClick={() => shift(-1)} aria-label="이전 달">‹</button>
          {year}.{String(month).padStart(2, '0')}
          <button onClick={() => shift(1)} aria-label="다음 달">›</button>
        </span>
        {!isThisMonth && (
          <button className="bud-edit" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}>오늘</button>
        )}
      </header>

      <div className="body">
        <div className="cal">
          <div className="cal-week">
            {WEEK.map((w, i) => <span key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</span>)}
          </div>
          <div className="cal-grid">
            {grid.map((day, i) => {
              if (day === null) return <span key={`b${i}`} className="cal-cell blank" />;
              const spent = spendBy[day] || 0;
              const today = isThisMonth && day === now.getDate();
              return (
                <button key={day}
                  className={`cal-cell${spent > 0 ? ' spent' : ''}${today ? ' today' : ''}`}
                  onClick={() => setSel(day)}
                  aria-label={`${month}월 ${day}일 지출 ${fmt(spent)}원 — 눌러서 등록`}>
                  <em className="cal-d">{day}</em>
                  <span className="cal-amt num">{short(spent)}</span>
                </button>
              );
            })}
          </div>
          <p className="cal-hint">날짜를 누르면 그날 지출을 등록해요</p>
        </div>

        <div className="month-total">
          <span className="mt-label">{month}월 총 지출</span>
          <strong className="mt-amount num">{fmt(sum.total)}<em>원</em></strong>
          <span className="mt-sub">
            {sum.count}건
            {sum.dailyAvg > 0 && <> · 하루 평균 <b className="num">{fmt(sum.dailyAvg)}</b>원</>}
          </span>
        </div>
      </div>

      <DayExpenseSheet key={sel ?? 'none'} isOpen={sel !== null} year={year} month={month} day={sel}
        categories={categories} items={selItems}
        onClose={() => setSel(null)} onSubmit={submit} onDelete={onDeleteExpense} />
    </div>
  );
}
