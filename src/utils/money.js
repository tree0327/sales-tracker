// 금액 포매팅 + 매출 반영액 계산.

// 천단위 콤마 + 음수는 유니코드 마이너스(−)로. 0원도 '0'.
export function fmt(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('en-US');
}

// 부호 붙여서 (+/−). 수입/지출 표시에.
export function fmtSigned(n) {
  const v = Math.round(Number(n) || 0);
  return (v >= 0 ? '+' : '−') + Math.abs(v).toLocaleString('en-US');
}

// 거래 1건의 매출 반영액(final) 계산. 결제수단과 무관하게 원금 그대로 —
// 카드 수수료 차감은 폐지됐다. final 컬럼은 기존 데이터·집계 호환을 위해 유지한다.
export function computeFinal({ amount }) {
  return Number(amount) || 0;
}

// 거래 수정 시 DB에 보낼 패치. addTransaction 의 payload 규칙과 동일해야 한다
// — final 재계산과 급여→계좌 강제 둘 다. 어긋나면 추가와 수정의 결과가 갈린다.
export function buildUpdatePatch({ flow, category, method, amount, memo, date, owner }) {
  const patch = {
    // 수정 시트가 카테고리·유형(flow)을 바꿀 수 있으므로 patch 에 포함
    flow, category,
    amount: Number(amount) || 0,
    final: computeFinal({ amount }),
    method: flow === 'income' && category === '급여' ? '계좌' : method,
    memo: (memo || '').trim(),
    date,
  };
  // owner 는 수정 시트가 명시적으로 넘길 때만 갱신한다.
  // 안 넘기면(매출 수정 경로) DB의 기존 소유자를 건드리지 않는다 — undefined 를 patch 에
  // 넣으면 supabase 가 null 로 덮어써 not null 제약에 걸린다.
  if (owner !== undefined) patch.owner = owner;
  return patch;
}
