// 챗봇 롤링 요약 메모리 정책(순수 함수).
// 최근 10턴(=메시지 20개)은 통째로 유지. 미요약 메시지가 KEEP+BATCH개 이상 쌓이면
// 가장 오래된 BATCH개를 요약으로 밀어낸다.
export const KEEP_MSGS = 20;  // 최근 10턴(대화 10쌍) 유지 목표
export const BATCH_MSGS = 10; // 초과분이 이만큼 쌓이면 한 번에 요약(5턴)

// 반환: { shouldSummarize, from, to } — messages.slice(from, to)가 요약 대상.
export function planSummarization(total, summarizedCount, keep = KEEP_MSGS, batch = BATCH_MSGS) {
  const unsummarized = total - summarizedCount;
  if (unsummarized >= keep + batch) {
    return { shouldSummarize: true, from: summarizedCount, to: summarizedCount + batch };
  }
  return { shouldSummarize: false, from: summarizedCount, to: summarizedCount };
}

// 아직 요약되지 않은 메시지 전체(=LLM에 verbatim으로 전달할 부분).
export function verbatimFrom(messages, summarizedCount) {
  return messages.slice(summarizedCount);
}
