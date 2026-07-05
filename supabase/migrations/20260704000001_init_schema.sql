-- ============================================================
-- Coursada: core schema
-- (Already applied to project uootbtclscecwaumcelj via MCP —
--  kept in the repo as the source of truth for new environments.)
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'student' check (role in ('student', 'admin')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'General',
  price numeric(10,2) not null default 0 check (price >= 0),
  currency text not null default 'USD',
  thumbnail_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- video_key is the Contabo object path, NEVER a full URL.
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  video_key text,
  duration_seconds integer not null default 0,
  is_preview boolean not null default false,
  sort_order integer not null default 0,
  resources jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rows written ONLY by the create-payment edge function (service role).
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'expired', 'cancelled', 'refunded')),
  payment_channel text check (payment_channel in ('EVC', 'ZAAD')),
  payment_reference text,
  phone_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  last_position_seconds numeric not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index idx_courses_status on public.courses (status) where deleted_at is null;
create index idx_courses_category on public.courses (category);
create index idx_modules_course on public.modules (course_id, sort_order);
create index idx_lessons_module on public.lessons (module_id, sort_order);
create index idx_lessons_course on public.lessons (course_id);
create index idx_purchases_user on public.purchases (user_id);
create index idx_purchases_course on public.purchases (course_id);
create unique index uq_purchases_completed on public.purchases (user_id, course_id) where status = 'completed';
create index idx_progress_user_course on public.progress (user_id, course_id);
create index idx_progress_lesson on public.progress (lesson_id);

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.has_purchased(p_course_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.purchases
    where user_id = auth.uid()
      and course_id = p_course_id
      and status = 'completed'
  );
$$;

-- Public syllabus (course detail page): exposes lesson titles/durations
-- but NEVER video_key. Works for anonymous visitors on published courses.
create or replace function public.get_course_syllabus(p_course_id uuid)
returns table (
  module_id uuid,
  module_title text,
  module_sort integer,
  lesson_id uuid,
  lesson_title text,
  lesson_sort integer,
  duration_seconds integer,
  is_preview boolean,
  has_video boolean
)
language sql stable security definer
set search_path = public
as $$
  select
    m.id, m.title, m.sort_order,
    l.id, l.title, l.sort_order,
    l.duration_seconds, l.is_preview, (l.video_key is not null)
  from public.modules m
  join public.courses c on c.id = m.course_id
  left join public.lessons l on l.module_id = m.id
  where m.course_id = p_course_id
    and c.deleted_at is null
    and (c.status = 'published' or public.is_admin())
  order by m.sort_order asc, l.sort_order asc;
$$;

grant execute on function public.get_course_syllabus(uuid) to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();
create trigger trg_modules_updated_at before update on public.modules
  for each row execute function public.set_updated_at();
create trigger trg_lessons_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();
create trigger trg_purchases_updated_at before update on public.purchases
  for each row execute function public.set_updated_at();
create trigger trg_progress_updated_at before update on public.progress
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.prevent_role_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();
