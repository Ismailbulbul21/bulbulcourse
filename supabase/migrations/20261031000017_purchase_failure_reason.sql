-- Keep why each payment failed, so declines can be counted instead of guessed.
alter table public.purchases
  add column if not exists failure_code text,
  add column if not exists failure_reason text;

create index if not exists purchases_failure_code_idx
  on public.purchases (failure_code)
  where failure_code is not null;
