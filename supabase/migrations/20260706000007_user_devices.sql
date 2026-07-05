-- One active playback device per user. The newest device to open the app
-- claims the slot; get-video-url refuses to sign URLs for other devices.
create table public.user_devices (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  device_id text not null,
  user_agent text,
  updated_at timestamptz not null default now()
);

alter table public.user_devices enable row level security;

create policy "devices_select_own"
  on public.user_devices for select
  using (user_id = auth.uid());

create policy "devices_insert_own"
  on public.user_devices for insert
  with check (user_id = auth.uid());

create policy "devices_update_own"
  on public.user_devices for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger trg_user_devices_updated_at
  before update on public.user_devices
  for each row execute function public.set_updated_at();
