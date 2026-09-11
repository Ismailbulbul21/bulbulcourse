-- ============================================================
-- "Hire me": service packages, portfolio, client requests, settings.
-- Additive only — nothing here touches courses, lessons, purchases
-- or payments.
-- ============================================================

-- ── Site settings (key/value) ──────────────────────────────────────
-- Public rows (WhatsApp number, feature switches) are readable by
-- everyone; private rows (Google Meet link) only by admins and by
-- server-side functions using the service role.
create table if not exists public.app_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,62}$'),
  value text not null default '',
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "app_settings_select_public_or_admin"
  on public.app_settings for select
  using (is_public or public.is_admin());
create policy "app_settings_admin_insert"
  on public.app_settings for insert with check (public.is_admin());
create policy "app_settings_admin_update"
  on public.app_settings for update
  using (public.is_admin()) with check (public.is_admin());
create policy "app_settings_admin_delete"
  on public.app_settings for delete using (public.is_admin());

create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- Both features start switched OFF: deploying the code shows customers
-- nothing new until the admin turns them on.
insert into public.app_settings (key, value, is_public) values
  ('whatsapp_number', '', true),
  ('services_enabled', 'false', true),
  ('booking_enabled', 'false', true),
  ('meeting_url', '', false)
on conflict (key) do nothing;

-- ── Service packages ───────────────────────────────────────────────
create table if not exists public.service_packages (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'mobile'
    check (category in ('mobile', 'web', 'system', 'other')),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text not null default '',
  price_from numeric(10,2) check (price_from is null or price_from >= 0),
  currency text not null default 'USD',
  delivery_time text not null default '',
  features text[] not null default '{}',
  is_featured boolean not null default false,
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_packages enable row level security;

create policy "service_packages_select_active_or_admin"
  on public.service_packages for select using (is_active or public.is_admin());
create policy "service_packages_admin_insert"
  on public.service_packages for insert with check (public.is_admin());
create policy "service_packages_admin_update"
  on public.service_packages for update
  using (public.is_admin()) with check (public.is_admin());
create policy "service_packages_admin_delete"
  on public.service_packages for delete using (public.is_admin());

create trigger trg_service_packages_updated_at
  before update on public.service_packages
  for each row execute function public.set_updated_at();

-- ── Portfolio ──────────────────────────────────────────────────────
create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text not null default '',
  category text not null default 'mobile'
    check (category in ('mobile', 'web', 'system', 'other')),
  image_url text,
  project_url text check (project_url is null or project_url ~* '^https?://'),
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portfolio_projects enable row level security;

create policy "portfolio_select_active_or_admin"
  on public.portfolio_projects for select using (is_active or public.is_admin());
create policy "portfolio_admin_insert"
  on public.portfolio_projects for insert with check (public.is_admin());
create policy "portfolio_admin_update"
  on public.portfolio_projects for update
  using (public.is_admin()) with check (public.is_admin());
create policy "portfolio_admin_delete"
  on public.portfolio_projects for delete using (public.is_admin());

create trigger trg_portfolio_updated_at
  before update on public.portfolio_projects
  for each row execute function public.set_updated_at();

-- ── Client requests ────────────────────────────────────────────────
create table if not exists public.project_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  project_type text not null default 'other'
    check (project_type in ('mobile', 'web', 'system', 'other')),
  package_id uuid references public.service_packages(id) on delete set null,
  budget text not null default '' check (char_length(budget) <= 80),
  message text not null check (char_length(btrim(message)) between 10 and 4000),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  admin_note text not null default '',
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inquiries_created on public.project_inquiries (created_at desc);
create index if not exists idx_inquiries_status on public.project_inquiries (status);

alter table public.project_inquiries enable row level security;

-- Anyone, even logged out, may SEND a request — but cannot pick its
-- status, write admin notes, or claim to be another user.
create policy "inquiries_insert_anyone"
  on public.project_inquiries for insert
  to anon, authenticated
  with check (
    status = 'new'
    and admin_note = ''
    and (user_id is null or user_id = auth.uid())
  );

-- Only the admin can read and manage requests.
create policy "inquiries_admin_select"
  on public.project_inquiries for select using (public.is_admin());
create policy "inquiries_admin_update"
  on public.project_inquiries for update
  using (public.is_admin()) with check (public.is_admin());
create policy "inquiries_admin_delete"
  on public.project_inquiries for delete using (public.is_admin());

-- Normalise the phone and apply basic spam protection: at most 3
-- requests per phone number per hour, and 30 site-wide per hour.
create or replace function public.guard_project_inquiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent integer;
begin
  new.phone := regexp_replace(coalesce(new.phone, ''), '[^0-9+]', '', 'g');
  new.name := btrim(new.name);
  new.email := nullif(btrim(coalesce(new.email, '')), '');

  select count(*) into recent
  from public.project_inquiries
  where phone = new.phone and created_at > now() - interval '1 hour';
  if recent >= 3 then
    raise exception 'Codsiyo badan ayaa lambarkan ka yimid. Fadlan dib u isku day saacad kadib.';
  end if;

  select count(*) into recent
  from public.project_inquiries
  where created_at > now() - interval '1 hour';
  if recent >= 30 then
    raise exception 'Codsiyo badan ayaa hadda imanaya. Fadlan dib u isku day wax yar kadib.';
  end if;

  return new;
end;
$$;

create trigger trg_guard_project_inquiry
  before insert on public.project_inquiries
  for each row execute function public.guard_project_inquiry();

create trigger trg_inquiries_updated_at
  before update on public.project_inquiries
  for each row execute function public.set_updated_at();

-- Trigger functions must not be callable through the REST RPC endpoint.
revoke execute on function public.guard_project_inquiry() from public, anon, authenticated;
