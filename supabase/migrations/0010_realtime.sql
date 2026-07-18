-- 실시간 동기화: 가계부 테이블을 realtime publication 에 추가.
-- 두 번 실행해도 안전하도록(이미 추가된 경우 무시) DO 블록으로 감싼다.
do $$ begin
  alter publication supabase_realtime add table public.transactions;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.fixed_expenses;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.expense_categories;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.budgets;
exception when duplicate_object then null; end $$;
