-- AI 챗봇 대화/요약 영구 저장(사용자별 1행). 새로고침·재접속해도 대화 유지.
create table if not exists public.ai_chat (
  user_id uuid primary key default auth.uid(),
  messages jsonb not null default '[]'::jsonb,
  summary text not null default '',
  summarized_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ai_chat enable row level security;

create policy "ai_chat_select_own" on public.ai_chat
  for select to authenticated using (user_id = auth.uid());
create policy "ai_chat_insert_own" on public.ai_chat
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_chat_update_own" on public.ai_chat
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_chat_delete_own" on public.ai_chat
  for delete to authenticated using (user_id = auth.uid());
