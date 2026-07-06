import { supabase } from '../supabaseClient';

// Edge Function 'ai' 호출. mode: 'report' | 'chat' | 'anomaly'
// 성공 시 생성 텍스트(string) 반환, 실패 시 throw.
export async function callAI(mode, payload) {
  const { data, error } = await supabase.functions.invoke('ai', { body: { mode, payload } });
  if (error) throw new Error(error.message || 'AI 요청에 실패했습니다.');
  if (data?.error) throw new Error(data.error);
  return data?.text ?? '';
}
