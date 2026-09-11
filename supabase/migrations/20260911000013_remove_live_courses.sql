-- ============================================================
-- Remove the live-courses feature (added in 20260811000012).
--
-- Apply ONLY after the reverted frontend is deployed. The currently
-- deployed code still sends course_type / live_* fields when saving a
-- course in Admin; dropping the columns first would break that for the
-- minute before the new deploy lands.
--
-- The archived bootcamp course row is deliberately KEPT (soft-deleted,
-- invisible everywhere): 14 payment attempts reference it, and deleting
-- the course would cascade-delete that payment history.
-- ============================================================

drop table if exists public.live_course_access;
drop table if exists public.live_sessions;

alter table public.courses drop constraint if exists courses_course_type_check;
alter table public.courses drop column if exists course_type;
alter table public.courses drop column if exists live_starts_on;
alter table public.courses drop column if exists live_ends_on;
