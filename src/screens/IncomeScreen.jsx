import { fmt } from '../utils/money';
import { incomeList, sumFinal } from '../utils/ledger';
import TxRow from '../components/TxRow';

// 급여관리(남편). 매출관리는 별도 탭(SalesScreen)으로 분리됐다.
export default function IncomeScreen({ transactions, onAddIncome }) {
  const list = incomeList(transactions).filter((t) => t.category === '급여');
  const tot = sumFinal(list);

  return (
    <div>
      <header className="app-head"><span className="title">급여관리</span></header>
      <div className="body">
        <div className="mini-hero">
          <div>
            <div className="k">이번 달 급여</div>
            <div className="v num pos">{fmt(tot)}<span className="unit">원</span></div>
          </div>
          <div className="r"><span className="owner-badge">남편</span><br /><b>실수령</b></div>
        </div>
        <button className="add-row" onClick={() => onAddIncome('급여')}>＋ 급여 입력 (금액만)</button>

        <div className="sec-title">급여 내역 <span className="r">{list.length}건</span></div>
        {list.length === 0 && <div className="empty">아직 내역이 없어요.</div>}
        {list.map((t) => <TxRow key={t.id} tx={t} showCategory={false} />)}
      </div>
    </div>
  );
}
