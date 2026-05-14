-- Plan 03: like_profile, unlike_profile. view_likes_tab is appended in Task 12.
-- like is idempotent (UPSERT). unlike is idempotent (DELETE returns rows_deleted but ok=true regardless).
-- Decision (Open Q 2): unlike does NOT delete the prior 'like' notification (historical event stands).

CREATE OR REPLACE FUNCTION public.like_profile(p_likee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  was_inserted boolean;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  IF me = p_likee_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_like_self');
  END IF;

  -- Verify likee is active (don't let users like inactive/suspended/deactivated profiles).
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_likee_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  INSERT INTO public.likes (liker_id, likee_id) VALUES (me, p_likee_id)
    ON CONFLICT (liker_id, likee_id) DO NOTHING
    RETURNING true INTO was_inserted;

  -- Insert notification only on first like (was_inserted = true).
  IF was_inserted IS TRUE THEN
    INSERT INTO public.notifications (recipient_id, kind, payload)
    VALUES (
      p_likee_id,
      'like',
      jsonb_build_object(
        'actor_id', me,
        'actor_name', (SELECT display_name FROM public.profiles WHERE id = me)
      )
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.like_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unlike_profile(p_likee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  DELETE FROM public.likes WHERE liker_id = me AND likee_id = p_likee_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlike_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.view_likes_tab() RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, extensions
AS $$
DECLARE
  me uuid := auth.uid();
  liked_me  jsonb := '[]'::jsonb;
  favourites jsonb := '[]'::jsonb;
  card jsonb;
  rec record;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  -- "liked_me" = people who liked me, excluding those I already liked back (those are "matches" — deferred)
  FOR rec IN
    SELECT l.liker_id AS profile_id
      FROM public.likes l
     WHERE l.likee_id = me
       AND NOT EXISTS (
         SELECT 1 FROM public.likes l2 WHERE l2.liker_id = me AND l2.likee_id = l.liker_id
       )
     ORDER BY l.created_at DESC
     LIMIT 50
  LOOP
    card := public._profile_card_for_viewer(me, rec.profile_id);
    IF card IS NOT NULL THEN liked_me := liked_me || card; END IF;
  END LOOP;

  -- "favourites" = people I liked
  FOR rec IN
    SELECT l.likee_id AS profile_id
      FROM public.likes l
     WHERE l.liker_id = me
     ORDER BY l.created_at DESC
     LIMIT 50
  LOOP
    card := public._profile_card_for_viewer(me, rec.profile_id);
    IF card IS NOT NULL THEN favourites := favourites || card; END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'liked_me', liked_me,
    'favourites', favourites
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_likes_tab() TO authenticated;
