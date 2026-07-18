// 금액 포매팅 + 카드 수수료 계산.

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

export const CARD_FEE_RATE = 0.1;

// 매출 카드결제 실수령 = floor(원금 × 0.9). 정수연산으로 DB와 일치.
export function cardFinal(original) {
  const n = Number(original) || 0;
  return Math.floor((n * 900) / 1000);
}

// 거래 1건의 매출 반영액(final) 계산.
// 매출 + 카드 → 수수료 10% 차감, 그 외 → 원금 그대로.
export function computeFinal({ flow, category, method, amount }) {
  const n = Number(amount) || 0;
  if (flow === 'income' && category === '매출' && method === '카드') return cardFinal(n);
  return n;
}

// 거래 수정 시 DB에 보낼 패치. addTransaction 의 payload 규칙과 동일해야 한다
// — final 재계산과 급여→계좌 강제 둘 다. 어긋나면 추가와 수정의 결과가 갈린다.
export function buildUpdatePatch({ flow, category, method, amount, memo, date, owner }) {
  const patch = {
    // 수정 시트가 카테고리·유형(flow)을 바꿀 수 있으므로 patch 에 포함
    flow, category,
    amount: Number(amount) || 0,
    final: computeFinal({ flow, category, method, amount }),
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
