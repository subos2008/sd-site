-- Plan 03: likes table. Spec §3 + §6.
-- Composite PK enforces idempotency (no double-likes).

CREATE TABLE public.likes (
  liker_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  likee_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (liker_id, likee_id),
  CHECK (liker_id <> likee_id)
);

CREATE INDEX likes_by_likee ON public.likes (likee_id, created_at DESC);
CREATE INDEX likes_by_liker ON public.likes (liker_id, created_at DESC);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- SELECT: either side can see
CREATE POLICY likes_select_self
  ON public.likes
  FOR SELECT
  TO authenticated
  USING (liker_id = auth.uid() OR likee_id = auth.uid());

-- INSERT: only as the liker
CREATE POLICY likes_insert_self
  ON public.likes
  FOR INSERT
  TO authenticated
  WITH CHECK (liker_id = auth.uid());

-- DELETE: only by the liker
CREATE POLICY likes_delete_self
  ON public.likes
  FOR DELETE
  TO authenticated
  USING (liker_id = auth.uid());

-- No UPDATE policy: deny-all.
