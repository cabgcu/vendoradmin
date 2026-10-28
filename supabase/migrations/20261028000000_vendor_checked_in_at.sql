-- =====================================================================
-- CAB Student Markets — check-in timestamp
-- =====================================================================
-- Run ONCE in the Supabase dashboard: SQL Editor -> New query -> paste
-- this whole file -> Run.
--
-- Adds vendors.checked_in_at, set by the admin dashboard when a student
-- is checked in at a market and cleared if the check-in is undone.
-- =====================================================================

alter table public.vendors add column if not exists checked_in_at timestamptz;
