-- 공금 충전(입금)을 위해 transactions.flow 에 'transfer' 허용.
-- transfer = 공금 통장에 넣는 돈. 전체 가계 수입/지출엔 안 잡히고 공금 잔고만 올린다.
alter table public.transactions drop constraint if exists transactions_flow_check;
alter table public.transactions add constraint transactions_flow_check
  check (flow in ('income', 'expense', 'transfer'));
