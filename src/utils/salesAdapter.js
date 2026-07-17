// analytics.js 는 예전 미용실앱 스키마(type/original/name)를 기대하고,
// 현재 데이터는 transactions(method/amount/memo)에 산다.
// 매출 탭이 예전 UI·분석 함수를 그대로 재사용하도록 형태만 바꿔주는 순수 어댑터.

export function toSalesRecord(tx) {
  return {
    id: tx.id,
    type: tx.method,
    original: tx.amount,
    final: tx.final,
    name: tx.memo || '',
    date: tx.date,
  };
}

export function salesRecords(transactions) {
  return transactions
    .filter((t) => t.flow === 'income' && t.category === '매출')
    .map(toSalesRecord);
}
