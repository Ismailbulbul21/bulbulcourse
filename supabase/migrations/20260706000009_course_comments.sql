-- Per-course Q&A / feedback. Only buyers of the course (or admins) can read
-- and post; admins can reply to anyone. One level of threading via parent_id.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_comments_course on public.comments (course_id, created_at);
create index idx_comments_parent on public.comments (parent_id);

alter table public.comments enable row level security;

create policy "comments_select_buyers_admin"
  on public.comments for select
  using (public.has_purchased(course_id) or public.is_admin());

create policy "comments_insert_buyers_admin"
  on public.comments for insert
  with check (
    user_id = auth.uid()
    and (public.has_purchased(course_id) or public.is_admin())
  );

create policy "comments_update_own"
  on public.comments for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "comments_delete_own_or_admin"
  on public.comments for delete
  using (user_id = auth.uid() or public.is_admin());

create trigger trg_comments_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

create or replace function public.get_course_comments(p_course_id uuid)
returns table (
  id uuid,
  parent_id uuid,
  body text,
  created_at timestamptz,
  user_id uuid,
  author_name text,
  author_is_admin boolean
)
language sql stable security definer
set search_path = public
as $$
  select
    c.id, c.parent_id, c.body, c.created_at, c.user_id,
    coalesce(nullif(p.full_name, ''), 'Student') as author_name,
    (p.role = 'admin') as author_is_admin
  from public.comments c
  join public.profiles p on p.id = c.user_id
  where c.course_id = p_course_id
    and (public.has_purchased(p_course_id) or public.is_admin())
  order by c.created_at asc;
$$;

grant execute on function public.get_course_comments(uuid) to authenticated;
