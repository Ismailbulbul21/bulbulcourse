-- Trigger functions must not be callable via the REST RPC endpoint.
-- (They still run fine as triggers — those execute as the table owner.)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.prevent_role_change() from public, anon, authenticated;

-- Intentionally kept executable:
--   is_admin(), has_purchased()   → used inside RLS policies and by the client
--   get_course_syllabus()         → public syllabus, returns safe columns only
