import { supabase } from '../supabaseClient';

const TABLE = 'ai_chat';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// 로그인 사용자의 저장된 대화 복원. 없으면 null.
// (RLS가 이미 본인 행만 반환하지만, 명시적으로 user_id로 필터해 의도를 분명히 한다.)
export async function loadChat() {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select('messages, summary, summarized_count')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    messages: Array.isArray(data.messages) ? data.messages : [],
    summary: data.summary ?? '',
    summarizedCount: data.summarized_count ?? 0,
  };
}

// 대화/요약 upsert(사용자별 1행).
export async function saveChat({ messages, summary, summarizedCount }) {
  const uid = await currentUserId();
  if (!uid) throw new Error('로그인이 필요합니다.');
  const { error } = await supabase.from(TABLE).upsert({
    user_id: uid,
    messages,
    summary,
    summarized_count: summarizedCount,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

// 대화 초기화(행 삭제).
export async function clearChat() {
  const uid = await currentUserId();
  if (!uid) return;
  const { error } = await supabase.from(TABLE).delete().eq('user_id', uid);
  if (error) throw new Error(error.message);
}
