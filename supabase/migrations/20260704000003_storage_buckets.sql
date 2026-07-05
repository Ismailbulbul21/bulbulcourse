-- ============================================================
-- Coursada: Supabase Storage buckets (small files ONLY —
-- videos live on Contabo, never here)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('resources', 'resources', true)
on conflict (id) do nothing;

create policy "course_assets_public_read"
  on storage.objects for select
  using (bucket_id in ('thumbnails', 'resources'));

create policy "course_assets_admin_insert"
  on storage.objects for insert
  with check (bucket_id in ('thumbnails', 'resources') and public.is_admin());

create policy "course_assets_admin_update"
  on storage.objects for update
  using (bucket_id in ('thumbnails', 'resources') and public.is_admin())
  with check (bucket_id in ('thumbnails', 'resources') and public.is_admin());

create policy "course_assets_admin_delete"
  on storage.objects for delete
  using (bucket_id in ('thumbnails', 'resources') and public.is_admin());
