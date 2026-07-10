-- Old/original price. When it is higher than price, the UI shows a
-- crossed-out old price + discount badge so students see the deal.
alter table public.courses
  add column if not exists compare_at_price numeric(10,2)
  check (compare_at_price is null or compare_at_price >= 0);
