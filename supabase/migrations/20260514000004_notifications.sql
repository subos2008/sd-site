-- Plan 03: notifications table. Spec §3 + §6.
-- INSERTs go via SECURITY DEFINER RPCs (the action that fires them is also the source of truth).
-- Owners can mark read or dismiss; otherwise the table is read-only on the client side.

CREATE TYPE notification_kind AS ENUM (
  'like',
  -- Plan 04+ will add: 'message', 'secret_access_request', 'secret_access_grant', 'token_purchase_complete'
  'placeholder'
);

CREATE TABLE public.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind          notification_kind NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  read_at       timestamptz,
  dismissed_at  timestamptz
);

CREATE INDEX notifications_by_recipient_recent
  ON public.notifications (recipient_id, created_at DESC);

CREATE INDEX notifications_unread
  ON public.notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: recipient only
CREATE POLICY notifications_recipient_select
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

-- UPDATE: recipient only (used for mark-read / dismiss)
CREATE POLICY notifications_recipient_update
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- No INSERT or DELETE policies: RPCs only.
