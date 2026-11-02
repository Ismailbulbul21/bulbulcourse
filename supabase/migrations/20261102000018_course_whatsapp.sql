-- One WhatsApp group invite link per course. Kept out of `courses` (which
-- everyone can read) so only buyers of that course and admins can see it.
create table public.course_whatsapp (
  course_id uuid primary key references public.courses(id) on delete cascade,
  url text not null check (url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]+$'),
  updated_at timestamptz not null default now()
);

alter table public.course_whatsapp enable row level security;

create policy "course_whatsapp_select_buyers_admin"
  on public.course_whatsapp for select
  using (public.has_purchased(course_id) or public.is_admin());

create policy "course_whatsapp_insert_admin"
  on public.course_whatsapp for insert with check (public.is_admin());

create policy "course_whatsapp_update_admin"
  on public.course_whatsapp for update using (public.is_admin()) with check (public.is_admin());

create policy "course_whatsapp_delete_admin"
  on public.course_whatsapp for delete using (public.is_admin());

create trigger trg_course_whatsapp_updated_at
  before update on public.course_whatsapp
  for each row execute function public.set_updated_at();
