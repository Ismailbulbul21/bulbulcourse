-- Add Sahal (Golis) to the accepted mobile-money wallets.
alter table public.purchases
  drop constraint if exists purchases_payment_channel_check;

alter table public.purchases
  add constraint purchases_payment_channel_check
  check (payment_channel in ('EVC', 'ZAAD', 'SAHAL'));
