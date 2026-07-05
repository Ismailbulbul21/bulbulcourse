-- Platform decision: exactly two categories.
update public.courses
set category = 'Web Development'
where category not in ('Mobile', 'Web Development');

alter table public.courses
  add constraint courses_category_check
  check (category in ('Mobile', 'Web Development'));
