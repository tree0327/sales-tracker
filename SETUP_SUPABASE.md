# Supabase 설정 (마지막 2단계 — 직접 진행 필요)

코드는 모두 적용되었습니다. 아래 두 단계만 직접 해주시면 매출 기록이 실제 Supabase DB에 저장됩니다.
(자동화 도구(MCP)가 이 프로젝트에 대한 테이블 생성/키 조회 권한을 거부하여, 이 두 단계만 수동으로 진행합니다.)

## 1단계: 테이블 생성

1. https://supabase.com/dashboard 접속 → 프로젝트 **jvtwxjkfntxnuepkfcuq** 선택
2. 좌측 **SQL Editor** → **New query**
3. 저장소의 `supabase/migrations/0001_create_sales_records.sql` 내용을 전부 붙여넣고 **Run**
   (또는 아래를 그대로 붙여넣기)

```sql
create table if not exists public.sales_records (
  id text primary key,
  type text not null,
  original numeric not null default 0,
  final numeric not null default 0,
  name text not null default '',
  date timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists sales_records_date_idx on public.sales_records (date desc);
alter table public.sales_records enable row level security;
create policy "public_select_sales_records" on public.sales_records for select to anon, authenticated using (true);
create policy "public_insert_sales_records" on public.sales_records for insert to anon, authenticated with check (true);
create policy "public_update_sales_records" on public.sales_records for update to anon, authenticated using (true) with check (true);
create policy "public_delete_sales_records" on public.sales_records for delete to anon, authenticated using (true);
```

## 2단계: API 키를 .env.local 에 입력

1. 대시보드 → **Settings** → **API**
2. **Publishable key**(`sb_publishable_...`) 또는 **Project API keys → anon public** 값을 복사
3. 프로젝트 루트 `.env.local` 파일의 키를 교체:

```
VITE_SUPABASE_URL=https://jvtwxjkfntxnuepkfcuq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<복사한 키>
```

## 3단계: 실행 및 확인

```
npm run dev
```

- 매출(현금/카드)을 추가 → **새로고침해도 유지**되면 DB 저장 성공입니다.
- 기존에 localStorage 에 쌓아둔 기록이 있으면, DB가 비어있을 때 **자동으로 1회 업로드**됩니다.
- Supabase 대시보드 → **Table Editor → sales_records** 에서 실제 행을 확인할 수 있습니다.

## 참고 (선택): MCP로 자동화하려면

Supabase MCP가 이 프로젝트에 대한 쓰기 작업을 모두 거부하고 있습니다(`permission denied`).
MCP 토큰/연결이 **read-only** 이거나 프로젝트 범위 권한이 없을 가능성이 큽니다.
`/mcp` 에서 Supabase를 **쓰기 권한 + 해당 프로젝트 접근**으로 다시 연결하면,
이후에는 테이블 생성/키 조회/검증을 자동으로 처리할 수 있습니다.
