// 하단 탭바: 홈 · 캘린더 · ＋(입력) · 매출 · 기록. ＋는 가운데 FAB.
// 지출 화면은 탭바에서 빠졌지만 홈의 '고정지출' 카드로 들어간다 —
// 그 화면에 있는 동안엔 캘린더 슬롯을 활성으로 둬서 현재 위치 표시가 비지 않게 한다.
export default function TabBar({ tab, onNav, onAdd }) {
  return (
    <nav className="tabbar">
      <button className={`tb ${tab === 'home' ? 'active' : ''}`} onClick={() => onNav('home')}><i>◆</i>홈</button>
      <button className={`tb ${tab === 'calendar' || tab === 'expense' ? 'active' : ''}`} onClick={() => onNav('calendar')}><i>▦</i>캘린더</button>
      <button className="fab" aria-label="입력" onClick={onAdd}>+</button>
      <button className={`tb ${tab === 'sales' ? 'active' : ''}`} onClick={() => onNav('sales')}><i>＋</i>매출</button>
      <button className={`tb ${tab === 'records' ? 'active' : ''}`} onClick={() => onNav('records')}><i>≣</i>기록</button>
    </nav>
  );
}
