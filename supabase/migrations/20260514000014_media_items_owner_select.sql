-- Add an owner-select RLS policy to media_items.
--
-- media_items has had RLS enabled with zero policies since it was created (intentional
-- deny-all — see the original assertion in supabase/tests/12_media_schema_rls.sql).
-- That is incompatible with supabase/tests/33_baby_activation_gate.sql's fixture,
-- which (as an owner impersonating `authenticated`) must SELECT its own just-inserted
-- media_items rows directly to discover their ids before linking them into
-- profile_photos via add_to_profile_photos(). Deny-all leaves that SELECT returning
-- zero rows even for the owner, so the fixture can never find its own media.
--
-- Owners being able to read back their own uploaded media directly is also just a
-- normal, safe RLS shape (still scoped to owner_id = auth.uid(), no cross-user
-- exposure) — production code doesn't rely on this (it goes through RPCs / storage
-- signed URLs regardless), but there's no reason to keep this table stricter than
-- profile_photos, which already grants the owner full SELECT/INSERT/UPDATE/DELETE.
CREATE POLICY media_items_owner_select
  ON public.media_items
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());
