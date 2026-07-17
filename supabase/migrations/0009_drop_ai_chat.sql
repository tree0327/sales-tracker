-- AI 챗봇 기능 제거. 0005_create_ai_chat.sql 을 되돌린다.
-- 정책은 테이블과 함께 사라지므로 별도 drop policy 불필요.
drop table if exists public.ai_chat;
