-- ============================================================
-- Coursada: Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.purchases enable row level security;
alter table public.progress enable row level security;

-- PROFILES
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- COURSES: anyone can read published; admins manage everything.
create policy "courses_select_published_or_admin"
  on public.courses for select
  using ((status = 'published' and deleted_at is null) or public.is_admin());

create policy "courses_admin_insert"
  on public.courses for insert with check (public.is_admin());
create policy "courses_admin_update"
  on public.courses for update using (public.is_admin()) with check (public.is_admin());
create policy "courses_admin_delete"
  on public.courses for delete using (public.is_admin());

-- MODULES
create policy "modules_select_published_or_admin"
  on public.modules for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.courses c
      where c.id = course_id and c.status = 'published' and c.deleted_at is null
    )
  );

create policy "modules_admin_insert"
  on public.modules for insert with check (public.is_admin());
create policy "modules_admin_update"
  on public.modules for update using (public.is_admin()) with check (public.is_admin());
create policy "modules_admin_delete"
  on public.modules for delete using (public.is_admin());

-- LESSONS: full rows (incl. video_key) only for admin / buyer / preview.
-- Anonymous syllabus browsing uses get_course_syllabus() (no video_key).
create policy "lessons_select_entitled"
  on public.lessons for select
  using (
    public.is_admin()
    or (
      exists (
        select 1 from public.courses c
        where c.id = course_id and c.status = 'published' and c.deleted_at is null
      )
      and (is_preview or public.has_purchased(course_id))
    )
  );

create policy "lessons_admin_insert"
  on public.lessons for insert with check (public.is_admin());
create policy "lessons_admin_update"
  on public.lessons for update using (public.is_admin()) with check (public.is_admin());
create policy "lessons_admin_delete"
  on public.lessons for delete using (public.is_admin());

-- PURCHASES: read own; ONLY the create-payment edge function writes
-- (service role bypasses RLS — no client insert/update policies).
create policy "purchases_select_own_or_admin"
  on public.purchases for select
  using (user_id = auth.uid() or public.is_admin());

-- PROGRESS: users fully own their rows.
create policy "progress_select_own"
  on public.progress for select using (user_id = auth.uid());
create policy "progress_insert_own"
  on public.progress for insert with check (user_id = auth.uid());
create policy "progress_update_own"
  on public.progress for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "progress_delete_own"
  on public.progress for delete using (user_id = auth.uid());
