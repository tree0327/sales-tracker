// 하단 탭바: 홈 · 지출 · ＋(입력) · 매출·급여 · 기록. ＋는 가운데 FAB.
export default function TabBar({ tab, onNav, onAdd }) {
  return (
    <nav className="tabbar">
      <button className={`tb ${tab === 'home' ? 'active' : ''}`} onClick={() => onNav('home')}><i>◆</i>홈</button>
      <button className={`tb ${tab === 'expense' ? 'active' : ''}`} onClick={() => onNav('expense')}><i>−</i>지출</button>
      <button className="fab" aria-label="입력" onClick={onAdd}>+</button>
      <button className={`tb ${tab === 'income' ? 'active' : ''}`} onClick={() => onNav('income')}><i>＋</i>매출·급여</button>
      <button className={`tb ${tab === 'records' ? 'active' : ''}`} onClick={() => onNav('records')}><i>≣</i>기록</button>
    </nav>
  );
}
