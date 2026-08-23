-- ============================================================
-- Live courses: a second product type alongside recorded courses.
-- (Already applied to project uootbtclscecwaumcelj via MCP —
--  kept in the repo as the source of truth for new environments.)
--
-- Recorded and live NEVER unlock each other. Access to a live
-- course's WhatsApp group is derived from a completed purchase of
-- that exact course, so a recorded purchase has nothing to match.
--
-- Existing rows default to 'recorded' — no data is migrated and no
-- existing behaviour changes.
-- ============================================================

alter table public.courses
  add column if not exists course_type text not null default 'recorded';

alter table public.courses drop constraint if exists courses_course_type_check;
alter table public.courses add constraint courses_course_type_check
  check (course_type in ('recorded', 'live'));

-- Overall run dates for a live course (the per-class schedule lives in
-- live_sessions below).
alter table public.courses add column if not exists live_starts_on date;
alter table public.courses add column if not exists live_ends_on date;

-- ── Class schedule ─────────────────────────────────────────────────
-- PUBLIC on purpose: students must see the dates and topics BEFORE
-- buying. Contains nothing secret — the WhatsApp link is elsewhere.
create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_live_sessions_course
  on public.live_sessions (course_id, starts_at);

alter table public.live_sessions enable row level security;

-- Same visibility rule as modules: catalog-visible courses only.
drop policy if exists "live_sessions_select_catalog" on public.live_sessions;
create policy "live_sessions_select_catalog"
  on public.live_sessions for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.courses c
      where c.id = course_id
        and c.status in ('published', 'coming_soon')
        and c.deleted_at is null
    )
  );

drop policy if exists "live_sessions_admin_insert" on public.live_sessions;
create policy "live_sessions_admin_insert"
  on public.live_sessions for insert with check (public.is_admin());

drop policy if exists "live_sessions_admin_update" on public.live_sessions;
create policy "live_sessions_admin_update"
  on public.live_sessions for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "live_sessions_admin_delete" on public.live_sessions;
create policy "live_sessions_admin_delete"
  on public.live_sessions for delete using (public.is_admin());

drop trigger if exists trg_live_sessions_updated_at on public.live_sessions;
create trigger trg_live_sessions_updated_at
  before update on public.live_sessions
  for each row execute function public.set_updated_at();

-- ── The WhatsApp group link ────────────────────────────────────────
-- SECRET. Kept out of public.courses on purpose: anyone (including
-- anonymous visitors) can select from courses, so a link stored there
-- would be readable by the whole internet. Row-level security cannot
-- hide a single column, hence a separate table.
create table if not exists public.live_course_access (
  course_id uuid primary key references public.courses(id) on delete cascade,
  whatsapp_group_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.live_course_access enable row level security;

-- Only someone with a COMPLETED purchase of this exact course, or an
-- admin, can read the link. Verified: anonymous and logged-in
-- non-buyers both see zero rows.
drop policy if exists "live_access_select_buyers_admin" on public.live_course_access;
create policy "live_access_select_buyers_admin"
  on public.live_course_access for select
  using (public.has_purchased(course_id) or public.is_admin());

drop policy if exists "live_access_admin_insert" on public.live_course_access;
create policy "live_access_admin_insert"
  on public.live_course_access for insert with check (public.is_admin());

drop policy if exists "live_access_admin_update" on public.live_course_access;
create policy "live_access_admin_update"
  on public.live_course_access for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "live_access_admin_delete" on public.live_course_access;
create policy "live_access_admin_delete"
  on public.live_course_access for delete using (public.is_admin());

drop trigger if exists trg_live_access_updated_at on public.live_course_access;
create trigger trg_live_access_updated_at
  before update on public.live_course_access
  for each row execute function public.set_updated_at();
