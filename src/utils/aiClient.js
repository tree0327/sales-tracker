import { supabase } from '../supabaseClient';

// Edge Function 'ai' 호출. mode: 'report' | 'chat' | 'anomaly' | 'summarize'
// 성공 시 생성 텍스트(string) 반환, 실패 시 throw.
export async function callAI(mode, payload) {
  const { data, error } = await supabase.functions.invoke('ai', { body: { mode, payload } });
  if (error) {
    console.error('AI Edge Function 호출 오류:', error);
    throw new Error('AI 기능을 사용할 수 없습니다. AI 서버(Edge Function)가 배포되어 있는지 확인해주세요.');
  }
  if (data?.error) throw new Error(data.error);
  return data?.text ?? '';
}
