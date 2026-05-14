ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users see their own row regardless of status; everyone else
-- sees only active rows. (Spec table says "Authenticated, status=active" — we widen
-- to include own-row-any-status so onboarding can read its own pending row.)
CREATE POLICY profiles_select_active_or_self
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (status = 'active' OR id = auth.uid());

-- UPDATE: owner only. Column-level allow-list is enforced by the RPCs (which are the
-- only path to UPDATE in production); the broad UPDATE policy here lets the
-- SECURITY DEFINER RPCs proceed when impersonating the user.
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT: no policy (default deny). Only the SECURITY DEFINER trigger creates rows.

-- DELETE: no policy (default deny). Account deletion will go through a future RPC.
