CREATE TYPE media_kind   AS ENUM ('photo', 'video');
CREATE TYPE media_status AS ENUM ('pending_moderation', 'approved', 'rejected');

CREATE TABLE public.media_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path    text NOT NULL,
  kind            media_kind NOT NULL,
  hash            text NOT NULL,
  size_bytes      int  NOT NULL,
  width           int,
  height          int,
  duration_seconds int,
  status          media_status NOT NULL DEFAULT 'approved',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, hash)
);

CREATE TABLE public.profile_photos (
  profile_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_item_id  uuid NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  ordinal        int  NOT NULL,
  PRIMARY KEY (profile_id, media_item_id)
);

CREATE INDEX profile_photos_by_profile_ordinal
  ON public.profile_photos (profile_id, ordinal);

-- Enforce: only photo kind allowed in profile_photos.
CREATE OR REPLACE FUNCTION public.tg_profile_photos_kind_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE k media_kind;
BEGIN
  SELECT kind INTO k FROM public.media_items WHERE id = NEW.media_item_id;
  IF k IS DISTINCT FROM 'photo' THEN
    RAISE EXCEPTION 'profile_photos requires media_items.kind=photo (got %)', k
      USING errcode = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER profile_photos_kind_check
  BEFORE INSERT OR UPDATE ON public.profile_photos
  FOR EACH ROW EXECUTE FUNCTION public.tg_profile_photos_kind_check();

-- RLS: media_items default-deny; profile_photos owner-only direct.
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
-- No policies: deny-all. RPCs are the only path.

ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_photos_owner_all
  ON public.profile_photos
  FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
-- Cross-user reads of profile_photos go through view RPCs that join media_items.
