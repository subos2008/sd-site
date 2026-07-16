-- Fix: grant base table privileges to `service_role`, matching the standard Supabase
-- posture (service_role is the trusted server-side admin role and should have full
-- CRUD on application tables, independent of RLS).
--
-- service_role has BYPASSRLS=true, but BYPASSRLS only skips row-security *policies* —
-- it does not substitute for the table-level GRANT that Postgres still requires before
-- any SELECT/INSERT/UPDATE/DELETE is permitted at all. Without these grants, a direct
-- table operation as `service_role` (e.g. scripts/seed-dev-users.mjs's
-- `supabase.from('profiles').update(...)` using the service-role key) fails with
-- "permission denied for table X" rather than succeeding as the trusted-admin role
-- normally would.
--
-- This is the same newer-Supabase-CLI regression that migration
-- 20260514000013_grant_authenticated_rls_tables.sql fixed for `authenticated` — that
-- migration did not cover `service_role`, since app code (SECURITY DEFINER RPCs) never
-- needed direct table grants for service_role. Local dev/admin tooling
-- (scripts/seed-dev-users.mjs) does use the service-role key for direct table writes,
-- so it silently failed (the script never checked the .error) leaving seeded profiles
-- stuck at pending_onboarding.
--
-- Unlike the `authenticated` grants (scoped to exactly what each table's RLS policies
-- already intend), service_role gets the full standard set on every app table listed
-- below — it is trusted, server-side-only, and bypasses RLS entirely.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_photos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_interests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.likes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;
