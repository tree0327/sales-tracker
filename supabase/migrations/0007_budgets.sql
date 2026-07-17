-- 월 예산: 전체 + 카테고리별
-- scope = '__overall__' (전체 변동지출 예산) 또는 지출 카테고리명
create table if not exists public.budgets (
  id         bigint generated always as identity primary key,
  scope      text not null unique,
  amount     numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.budgets enable row level security;

drop policy if exists "auth_select_budgets" on public.budgets;
drop policy if exists "auth_insert_budgets" on public.budgets;
drop policy if exists "auth_update_budgets" on public.budgets;
drop policy if exists "auth_delete_budgets" on public.budgets;

create policy "auth_select_budgets" on public.budgets for select to authenticated using (true);
create policy "auth_insert_budgets" on public.budgets for insert to authenticated with check (true);
create policy "auth_update_budgets" on public.budgets for update to authenticated using (true) with check (true);
create policy "auth_delete_budgets" on public.budgets for delete to authenticated using (true);

revoke all on table public.budgets from anon;
grant select, insert, update, delete on table public.budgets to authenticated;
