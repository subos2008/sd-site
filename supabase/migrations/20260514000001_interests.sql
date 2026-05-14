-- Plan 03: interests taxonomy + profile_interests junction.
-- interests is admin-managed (seeded via migration). profile_interests is owner-managed.

CREATE TABLE public.interests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_key  text NOT NULL UNIQUE,
  category   text NOT NULL,
  ordinal    int  NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.interests IS
  'Admin-managed interests taxonomy. label_key is the i18n key (e.g. "interest.hiking").';

CREATE TABLE public.profile_interests (
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interest_id uuid NOT NULL REFERENCES public.interests(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, interest_id)
);

CREATE INDEX profile_interests_by_interest ON public.profile_interests (interest_id);

-- RLS
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_interests ENABLE ROW LEVEL SECURITY;

-- interests: authenticated SELECT only (rows inserted via migration / service role)
CREATE POLICY interests_authenticated_select
  ON public.interests
  FOR SELECT
  TO authenticated
  USING (true);

-- profile_interests: owner can SELECT/INSERT/DELETE their own; UPDATE is meaningless (composite PK)
CREATE POLICY profile_interests_owner_select
  ON public.profile_interests
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY profile_interests_owner_insert
  ON public.profile_interests
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY profile_interests_owner_delete
  ON public.profile_interests
  FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());
