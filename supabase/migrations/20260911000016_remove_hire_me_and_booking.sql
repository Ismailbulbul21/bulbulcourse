-- ============================================================
-- Remove the Hire me and Booking features
-- (added in 20260911000014 and 20260911000015).
--
-- Apply only AFTER the reverted frontend is deployed: the deployed
-- code reads app_settings on every page load, so dropping that table
-- first would make those requests fail for visitors.
--
-- Every one of these tables was empty when it was dropped: no bookings,
-- session types, weekly hours, days off, packages, portfolio entries or
-- client requests.
--
-- Courses, lessons, purchases, progress and comments are NOT touched.
-- ============================================================

drop function if exists public.get_booking_stats();
drop function if exists public.get_available_slots(uuid, integer);
drop function if exists public.booking_slots_internal(uuid, integer);

-- bookings references session_types, so it is dropped first
drop table if exists public.bookings;
drop table if exists public.blocked_dates;
drop table if exists public.availability_rules;
drop table if exists public.session_types;

-- project_inquiries references service_packages, so it is dropped first
drop table if exists public.project_inquiries;
drop table if exists public.portfolio_projects;
drop table if exists public.service_packages;
drop table if exists public.app_settings;

drop function if exists public.guard_project_inquiry();
