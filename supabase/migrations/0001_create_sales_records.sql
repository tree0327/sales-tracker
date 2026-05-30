-- 매출 기록 테이블 (sales_records)
-- MCP 권한이 막힐 경우 Supabase 대시보드 → SQL Editor 에 붙여넣어 수동 실행 가능.
-- 인증 없는 데모 앱이라 publishable/anon 키로 CRUD 가능한 공개 RLS 정책을 둔다.

create table if not exists public.sales_records (
  id          text primary key,           -- 클라이언트 생성 id (uuid 또는 기존 숫자 id 문자열)
  type        text not null,              -- '현금' | '카드'
  original    numeric not null default 0, -- 원금
  final       numeric not null default 0, -- 최종 금액 (카드는 10% 수수료 차감)
  name        text not null default '',   -- 고객명/메모 (선택)
  date        timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists sales_records_date_idx on public.sales_records (date desc);

alter table public.sales_records enable row level security;

drop policy if exists "public_select_sales_records" on public.sales_records;
drop policy if exists "public_insert_sales_records" on public.sales_records;
drop policy if exists "public_update_sales_records" on public.sales_records;
drop policy if exists "public_delete_sales_records" on public.sales_records;

create policy "public_select_sales_records"
  on public.sales_records for select to anon, authenticated using (true);
create policy "public_insert_sales_records"
  on public.sales_records for insert to anon, authenticated with check (true);
create policy "public_update_sales_records"
  on public.sales_records for update to anon, authenticated using (true) with check (true);
create policy "public_delete_sales_records"
  on public.sales_records for delete to anon, authenticated using (true);
