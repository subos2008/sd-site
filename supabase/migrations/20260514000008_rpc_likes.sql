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
