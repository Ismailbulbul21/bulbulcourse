-- "Coming soon" courses: visible in the catalog (announcement only) but not
-- buyable/watchable. create-payment and get-video-url already require
-- status = 'published', so upcoming courses are locked server-side for free.
alter table public.courses drop constraint courses_status_check;
alter table public.courses add constraint courses_status_check
  check (status in ('draft', 'coming_soon', 'published', 'archived'));

-- Public can now also read coming_soon courses (title/description/thumbnail).
-- Modules/lessons/syllabus stay hidden — their policies require 'published'.
drop policy "courses_select_published_or_admin" on public.courses;
create policy "courses_select_published_or_admin"
  on public.courses for select
  using (
    (status in ('published', 'coming_soon') and deleted_at is null)
    or public.is_admin()
  );
