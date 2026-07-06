// 카드 수수료율 10%. 카드 최종액 = floor(원금 × 900 / 1000) = floor(원금 × 0.9) (정수연산으로 DB의 floor(original*0.9)와 일치).
export const CARD_FEE_RATE = 0.1;

export function finalAmount(type, original) {
  const n = Number(original) || 0;
  return type === '현금' ? n : Math.floor((n * 900) / 1000);
}
