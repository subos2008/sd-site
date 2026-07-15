-- Fix: grant base table privileges to `authenticated` matching the RLS policies
-- that already exist for these tables.
--
-- RLS policies alone do not grant access — Postgres requires an explicit table-level
-- GRANT before row-security policies can take effect. Without these grants, a direct
-- SELECT/UPDATE/etc as `authenticated` fails with "permission denied for table X"
-- instead of the RLS-filtered result the policies already describe (e.g. a direct
-- SELECT on media_items should return zero rows per its deny-all policy set, not
-- error out). This was a pre-existing gap: every RLS migration to date enabled RLS
-- and wrote policies, but never added the matching table GRANT.
--
-- No production behaviour changes: application code never queries these tables
-- directly — all reads/writes go through SECURITY DEFINER RPCs, which run with the
-- function owner's privileges regardless of the caller's table grants. This migration
-- only unblocks pgTAP assertions (supabase/tests/*) that read/write tables directly
-- to verify RLS behaviour.
--
-- Grants below are scoped to exactly the operations each table's existing policies
-- support for `authenticated` — no broader than what the policies already intend.

-- profiles: profiles_select_active_or_self (SELECT), profiles_update_own (UPDATE).
-- DELETE is granted with NO matching policy (RLS deny-all: a direct DELETE affects
-- zero rows rather than erroring), per supabase/tests/11_profiles_rls.sql. INSERT is
-- deliberately NOT granted (rows are created only by the SECURITY DEFINER
-- handle_new_user trigger) — that test expects a direct INSERT to raise outright.
GRANT SELECT, UPDATE, DELETE ON public.profiles TO authenticated;

-- media_items: RLS enabled with NO policies for authenticated (intentional deny-all,
-- see supabase/tests/12_media_schema_rls.sql). SELECT grant lets the query execute;
-- the absent policy still yields zero rows.
GRANT SELECT ON public.media_items TO authenticated;

-- profile_photos: profile_photos_owner_all is FOR ALL (SELECT/INSERT/UPDATE/DELETE).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_photos TO authenticated;

-- interests: interests_authenticated_select (SELECT only; taxonomy is admin-managed).
GRANT SELECT ON public.interests TO authenticated;

-- profile_interests: owner_select / owner_insert / owner_delete. No UPDATE policy
-- (composite PK makes UPDATE meaningless), so no UPDATE grant is added.
GRANT SELECT, INSERT, DELETE ON public.profile_interests TO authenticated;

-- likes: likes_select_self / likes_insert_self / likes_delete_self. UPDATE is granted
-- with NO matching policy (RLS deny-all: a direct UPDATE affects zero rows rather
-- than erroring), per supabase/tests/22_likes_schema_rls.sql.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.likes TO authenticated;

-- notifications: notifications_recipient_select (SELECT), notifications_recipient_update
-- (UPDATE). No INSERT/DELETE policy ("RPCs only."), so none is granted.
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
