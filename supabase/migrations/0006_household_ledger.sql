-- 부부 가계부(Phase 1) 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣어 실행하세요.
-- transactions(수입·지출) / fixed_expenses(고정지출) / expense_categories(지출 카테고리)

-- 1) 거래 (수입·지출 일반화). 기존 sales_records 를 대체한다.
create table if not exists public.transactions (
  id         bigint generated always as identity primary key,
  flow       text not null check (flow in ('income', 'expense')),
  amount     numeric not null default 0,          -- 원금
  final      numeric not null default 0,          -- 실수령(매출 카드 = floor(원금*0.9)), 그 외 amount와 동일
  category   text not null default '',            -- 지출/수입 카테고리
  owner      text not null check (owner in ('wife', 'husband', 'joint')),
  method     text not null default '카드',        -- '카드' | '현금' | '계좌'
  memo       text not null default '',
  date       timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists transactions_date_idx on public.transactions (date desc);

-- 2) 고정지출 (매달 자동 '-' 시작점)
create table if not exists public.fixed_expenses (
  id         bigint generated always as identity primary key,
  name       text not null,
  amount     numeric not null default 0,
  day        int not null default 1,              -- 결제일
  method     text not null default '계좌',
  created_at timestamptz not null default now()
);

-- 3) 지출 카테고리 (설정에서 추가/삭제)
create table if not exists public.expense_categories (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

-- RLS: 로그인 사용자(부부)만 전체 접근, anon 차단
alter table public.transactions       enable row level security;
alter table public.fixed_expenses      enable row level security;
alter table public.expense_categories  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['transactions', 'fixed_expenses', 'expense_categories'] loop
    execute format('drop policy if exists "auth_select_%1$s" on public.%1$s;', t);
    execute format('drop policy if exists "auth_insert_%1$s" on public.%1$s;', t);
    execute format('drop policy if exists "auth_update_%1$s" on public.%1$s;', t);
    execute format('drop policy if exists "auth_delete_%1$s" on public.%1$s;', t);
    execute format('create policy "auth_select_%1$s" on public.%1$s for select to authenticated using (true);', t);
    execute format('create policy "auth_insert_%1$s" on public.%1$s for insert to authenticated with check (true);', t);
    execute format('create policy "auth_update_%1$s" on public.%1$s for update to authenticated using (true) with check (true);', t);
    execute format('create policy "auth_delete_%1$s" on public.%1$s for delete to authenticated using (true);', t);
    execute format('revoke all on table public.%1$s from anon;', t);
    execute format('grant select, insert, update, delete on table public.%1$s to authenticated;', t);
  end loop;
end $$;

-- 기본 지출 카테고리 시드
insert into public.expense_categories (name, sort) values
  ('식비', 1), ('카페·간식', 2), ('생활', 3), ('데이트', 4),
  ('교통', 5), ('공과금', 6), ('쇼핑', 7), ('기타', 99)
on conflict (name) do nothing;

-- 기존 미용실 매출 이관: sales_records -> transactions (수입/매출/아내)
-- transactions 가 비어 있을 때만 1회 실행(멱등).
insert into public.transactions (flow, amount, final, category, owner, method, memo, date, created_at)
select 'income', sr.original, sr.final, '매출', 'wife', sr.type, coalesce(sr.name, ''), sr.date, sr.created_at
from public.sales_records sr
where not exists (select 1 from public.transactions);
