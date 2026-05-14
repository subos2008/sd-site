-- Plan 03: notifications RPCs.
-- view_notifications: SECURITY INVOKER works fine — RLS already restricts to recipient_id = me.
-- dismiss_notification + notifications_unread_count: SECURITY DEFINER for consistency with auth pattern.

CREATE OR REPLACE FUNCTION public.view_notifications(p_cursor text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  cur_created timestamptz;
  cur_id uuid;
  items jsonb := '[]'::jsonb;
  next_cursor text;
  rec record;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  IF p_cursor IS NOT NULL THEN
    cur_created := split_part(p_cursor, '|', 1)::timestamptz;
    cur_id      := split_part(p_cursor, '|', 2)::uuid;
  END IF;

  FOR rec IN
    SELECT id, kind, payload, created_at, read_at, dismissed_at
      FROM public.notifications
     WHERE recipient_id = me
       AND dismissed_at IS NULL
       AND (p_cursor IS NULL OR (created_at, id) < (cur_created, cur_id))
     ORDER BY created_at DESC, id DESC
     LIMIT 20
  LOOP
    items := items || jsonb_build_object(
      'id', rec.id,
      'kind', rec.kind,
      'payload', rec.payload,
      'created_at', rec.created_at,
      'read_at', rec.read_at
    );
    next_cursor := rec.created_at::text || '|' || rec.id::text;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'notifications', items,
    'next_cursor', next_cursor
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.view_notifications(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.dismiss_notification(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  rows_updated int;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  UPDATE public.notifications
     SET dismissed_at = now()
   WHERE id = p_id AND recipient_id = me;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  IF rows_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dismiss_notification(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notifications_unread_count()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  n int;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING errcode = 'P0001';
  END IF;

  SELECT count(*)::int INTO n
    FROM public.notifications
   WHERE recipient_id = me
     AND read_at IS NULL
     AND dismissed_at IS NULL;

  RETURN jsonb_build_object('ok', true, 'count', n);
END;
$$;

GRANT EXECUTE ON FUNCTION public.notifications_unread_count() TO authenticated;
