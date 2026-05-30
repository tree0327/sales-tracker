import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  // 환경변수가 없으면 앱을 죽이지 않고 경고만 남긴다(요청 시 에러 상태로 처리).
  console.error(
    'Supabase 환경변수가 없습니다. .env.local 에 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY 를 설정하세요.'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '');

export const RECORDS_TABLE = 'sales_records';
