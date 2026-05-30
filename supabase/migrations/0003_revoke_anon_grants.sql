-- anon(비로그인) 역할에서 테이블 권한 자체를 회수한다.
-- RLS 정책(authenticated 전용) 위에 한 겹 더 잠그는 효과.
revoke all on table public.sales_records from anon;
grant select, insert, update, delete on table public.sales_records to authenticated;
