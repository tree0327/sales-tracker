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

// 레거시(미용실 매출) 테이블 — 마이그레이션 후에는 참조하지 않는다.
export const RECORDS_TABLE = 'sales_records';

// 부부 가계부 테이블
export const TX_TABLE = 'transactions';
export const FIXED_TABLE = 'fixed_expenses';
export const CATEGORY_TABLE = 'expense_categories';
