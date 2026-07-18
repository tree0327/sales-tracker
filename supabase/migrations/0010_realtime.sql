-- 실시간 동기화: 가계부 테이블을 realtime publication 에 추가.
-- DELETE 이벤트에 old.id 가 실리도록 replica identity 는 기본(pk)이면 충분하다.
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.fixed_expenses;
alter publication supabase_realtime add table public.expense_categories;
alter publication supabase_realtime add table public.budgets;
