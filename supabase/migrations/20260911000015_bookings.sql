-- ============================================================
-- 1-on-1 booking: session types, weekly hours (Somalia time), days off,
-- bookings. Additive only — course payments and purchases are untouched;
-- bookings are paid through their own edge function (create-booking).
-- ============================================================

-- ── Session types ("60 min React help — $20") ──────────────────────
create table if not exists public.session_types (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text not null default '',
  duration_minutes integer not null
    check (duration_minutes between 15 and 240 and duration_minutes % 15 = 0),
  price numeric(10,2) check (price is null or price >= 0),
  currency text not null default 'USD',
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A session can't be offered to students until it has a price.
  constraint session_types_active_needs_price check (not is_active or price is not null)
);

alter table public.session_types enable row level security;
create policy "session_types_select_active_or_admin"
  on public.session_types for select using (is_active or public.is_admin());
create policy "session_types_admin_insert"
  on public.session_types for insert with check (public.is_admin());
create policy "session_types_admin_update"
  on public.session_types for update using (public.is_admin()) with check (public.is_admin());
create policy "session_types_admin_delete"
  on public.session_types for delete using (public.is_admin());
create trigger trg_session_types_updated_at
  before update on public.session_types
  for each row execute function public.set_updated_at();

-- ── Weekly hours, in Somalia time (Africa/Mogadishu) ───────────────
-- weekday: 0 = Sunday (Axad) … 6 = Saturday (Sabti), same as extract(dow).
create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint availability_rules_valid check (end_time > start_time)
);
create index if not exists idx_availability_weekday on public.availability_rules (weekday, start_time);

alter table public.availability_rules enable row level security;
-- Teaching hours are public information.
create policy "availability_select_all"
  on public.availability_rules for select using (true);
create policy "availability_admin_insert"
  on public.availability_rules for insert with check (public.is_admin());
create policy "availability_admin_update"
  on public.availability_rules for update using (public.is_admin()) with check (public.is_admin());
create policy "availability_admin_delete"
  on public.availability_rules for delete using (public.is_admin());

-- ── Days off ───────────────────────────────────────────────────────
-- Admin only: the reason may be personal. Slot calculation reads this
-- through a security-definer function.
create table if not exists public.blocked_dates (
  day date primary key,
  reason text not null default '',
  created_at timestamptz not null default now()
);
alter table public.blocked_dates enable row level security;
create policy "blocked_dates_admin_all"
  on public.blocked_dates for all using (public.is_admin()) with check (public.is_admin());

-- ── Bookings ───────────────────────────────────────────────────────
-- Written ONLY by the create-booking edge function (service role), so a
-- student can never fake a confirmed booking. Admins may update status,
-- notes and the meeting link from Admin.
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_type_id uuid not null references public.session_types(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'expired')),
  -- A pending booking holds the time until this moment, so a student with
  -- low balance can top up and retry without losing their slot.
  hold_expires_at timestamptz,
  topic text not null default '' check (char_length(topic) <= 1000),
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'USD',
  payment_channel text check (payment_channel in ('EVC', 'ZAAD', 'SAHAL', 'FREE')),
  payment_reference text,
  phone_number text,
  meeting_url text,
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_valid check (ends_at > starts_at),
  -- The teacher can't be in two sessions at once. Live holds and confirmed
  -- bookings may never overlap — enforced by the database, so two students
  -- racing for the same time cannot both win.
  constraint bookings_no_overlap exclude using gist (
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

create index if not exists idx_bookings_user on public.bookings (user_id, starts_at desc);
create index if not exists idx_bookings_starts on public.bookings (starts_at);
create index if not exists idx_bookings_status on public.bookings (status);

alter table public.bookings enable row level security;
create policy "bookings_select_own_or_admin"
  on public.bookings for select using (user_id = auth.uid() or public.is_admin());
create policy "bookings_admin_update"
  on public.bookings for update using (public.is_admin()) with check (public.is_admin());
create policy "bookings_admin_delete"
  on public.bookings for delete using (public.is_admin());
create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- ── Open times ─────────────────────────────────────────────────────
-- Every open start time for a session type: weekly hours on a 30-minute
-- grid (Somalia time), minus days off, minus confirmed bookings and live
-- holds, starting at least 2 hours from now. Used by the booking page AND
-- by create-booking to validate a requested time, so both always agree.
-- Returns only times — never who booked.
create or replace function public.booking_slots_internal(
  p_session_type_id uuid,
  p_days integer default 14
)
returns table (slot_start timestamptz, slot_end timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with st as (
    select id, duration_minutes
    from public.session_types
    where id = p_session_type_id and is_active and price is not null
  ),
  today as (
    select (now() at time zone 'Africa/Mogadishu')::date as d
  ),
  days as (
    select g::date as day
    from today,
         generate_series(
           today.d::timestamp,
           (today.d + (greatest(1, least(coalesce(p_days, 14), 60)) - 1))::timestamp,
           interval '1 day'
         ) as g
  ),
  candidates as (
    select distinct
      (s.local_start at time zone 'Africa/Mogadishu') as cs,
      ((s.local_start + make_interval(mins => st.duration_minutes)) at time zone 'Africa/Mogadishu') as ce
    from days dd
    join public.availability_rules ar on ar.weekday = extract(dow from dd.day)::int
    cross join st
    cross join lateral generate_series(
      dd.day + ar.start_time,
      dd.day + ar.end_time - make_interval(mins => st.duration_minutes),
      interval '30 minutes'
    ) as s(local_start)
    where not exists (select 1 from public.blocked_dates b where b.day = dd.day)
  )
  select c.cs, c.ce
  from candidates c
  where c.cs >= now() + interval '2 hours'
    and not exists (
      select 1
      from public.bookings bk
      where (bk.status = 'confirmed' or (bk.status = 'pending' and bk.hold_expires_at > now()))
        and tstzrange(bk.starts_at, bk.ends_at, '[)') && tstzrange(c.cs, c.ce, '[)')
    )
  order by c.cs;
$$;

-- Public wrapper: respects the booking switch (admins can always preview).
create or replace function public.get_available_slots(
  p_session_type_id uuid,
  p_days integer default 14
)
returns table (slot_start timestamptz, slot_end timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.slot_start, s.slot_end
  from public.booking_slots_internal(p_session_type_id, p_days) s
  where public.is_admin()
     or exists (
       select 1 from public.app_settings
       where key = 'booking_enabled' and value = 'true'
     );
$$;

-- ── Admin numbers ──────────────────────────────────────────────────
-- Kept separate from get_admin_stats so course revenue is unchanged.
create or replace function public.get_booking_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_admin() then json_build_object(
    'upcoming', (select count(*) from public.bookings where status = 'confirmed' and starts_at >= now()),
    'completed', (select count(*) from public.bookings where status = 'completed'),
    'paid', (select count(*) from public.bookings where status in ('confirmed', 'completed')),
    'revenue', (select coalesce(sum(amount), 0) from public.bookings where status in ('confirmed', 'completed')),
    'new_requests', (select count(*) from public.project_inquiries where status = 'new')
  ) else null end;
$$;

-- The internal slot function is for the edge function (service role)
-- and the public wrapper only.
revoke execute on function public.booking_slots_internal(uuid, integer) from public, anon, authenticated;
grant execute on function public.booking_slots_internal(uuid, integer) to service_role;
grant execute on function public.get_available_slots(uuid, integer) to anon, authenticated;

-- Stats return null for non-admins anyway, but logged-out visitors have no
-- reason to call them at all.
revoke execute on function public.get_booking_stats() from public, anon;
grant execute on function public.get_booking_stats() to authenticated;
