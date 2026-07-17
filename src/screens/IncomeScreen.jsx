import { fmt } from '../utils/money';
import { incomeList, sumFinal } from '../utils/ledger';
import TxRow from '../components/TxRow';

// 매출/급여관리: 매출관리(아내) / 급여관리(남편)
export default function IncomeScreen({ transactions, kind, onKind, onAddIncome }) {
  const list = incomeList(transactions).filter((t) => t.category === kind);
  const tot = sumFinal(list);
  const cash = sumFinal(list.filter((t) => t.method === '현금'));
  const card = sumFinal(list.filter((t) => t.method === '카드'));

  return (
    <div>
      <header className="app-head"><span className="title">매출/급여관리</span></header>
      <div className="body">
        <div className="seg">
          <button className={`s ${kind === '매출' ? 'on w' : ''}`} onClick={() => onKind('매출')}>매출관리 · 아내</button>
          <button className={`s ${kind === '급여' ? 'on h' : ''}`} onClick={() => onKind('급여')}>급여관리 · 남편</button>
        </div>

        {kind === '매출' ? (
          <>
            <div className="mini-hero">
              <div>
                <div className="k"><span className="dt w"></span>이번 달 미용실 매출</div>
                <div className="v num pos">{fmt(tot)}<span style={{ fontSize: 15, color: 'var(--fg-2)' }}>원</span></div>
              </div>
              <div className="r">현금 <b className="num">{fmt(cash)}</b><br />카드 <b className="num">{fmt(card)}</b></div>
            </div>
            <button className="add-row" onClick={() => onAddIncome('매출')}>＋ 미용실 매출 입력 (현금/카드)</button>
          </>
        ) : (
          <>
            <div className="mini-hero">
              <div>
                <div className="k"><span className="dt h"></span>이번 달 급여</div>
                <div className="v num pos">{fmt(tot)}<span style={{ fontSize: 15, color: 'var(--fg-2)' }}>원</span></div>
              </div>
              <div className="r">남편<br /><b>실수령</b></div>
            </div>
            <button className="add-row" onClick={() => onAddIncome('급여')}>＋ 급여 입력 (금액만)</button>
          </>
        )}

        <div className="sec-title">{kind === '매출' ? '매출 내역' : '급여 내역'} <span className="r">{list.length}건</span></div>
        {list.length === 0 && <div className="empty">아직 내역이 없어요.</div>}
        {list.map((t) => <TxRow key={t.id} tx={t} showCategory={false} />)}
      </div>
    </div>
  );
}
