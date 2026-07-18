// Supabase Realtime(postgres_changes) 이벤트를 로컬 목록에 병합하는 순수 함수.
// 자기 자신의 낙관적 갱신과 중복 수신돼도 안전해야 한다(id 기준 멱등).
export function applyRealtimeEvent(list, { eventType, new: newRow, old: oldRow }, { sortByDateDesc = false } = {}) {
  let next;
  if (eventType === 'DELETE') {
    next = list.filter((r) => r.id !== oldRow.id);
  } else { // INSERT | UPDATE — 둘 다 id 기준 upsert 로 처리해 순서 뒤바뀜·유실에 강하게
    const exists = list.some((r) => r.id === newRow.id);
    next = exists ? list.map((r) => (r.id === newRow.id ? newRow : r)) : [...list, newRow];
  }
  if (sortByDateDesc) next = [...next].sort((x, y) => new Date(y.date) - new Date(x.date));
  return next;
}
