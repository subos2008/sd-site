BEGIN;
SELECT plan(4);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'v1@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', ''),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'v2@x', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', '');

UPDATE public.profiles SET role='benefactor', status='active', display_name='Viewer',  date_of_birth='1980-01-01', city_lat=51.5, city_lng=-0.1, city_display_name='London' WHERE id='bbbbbbbb-0000-0000-0000-000000000001';
UPDATE public.profiles SET role='baby',       status='active', display_name='Target',  date_of_birth='1998-01-01', city_lat=51.5, city_lng=-0.1, city_display_name='London' WHERE id='bbbbbbbb-0000-0000-0000-000000000002';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bbbbbbbb-0000-0000-0000-000000000001';

WITH r AS (SELECT public.view_profile('bbbbbbbb-0000-0000-0000-000000000002'::uuid) AS body)
SELECT is((SELECT body->>'ok' FROM r), 'true', 'view_profile ok');
WITH r AS (SELECT public.view_profile('bbbbbbbb-0000-0000-0000-000000000002'::uuid) AS body)
SELECT is((SELECT body->'profile'->>'display_name' FROM r), 'Target', 'display_name returned');
WITH r AS (SELECT public.view_profile('bbbbbbbb-0000-0000-0000-000000000002'::uuid) AS body)
SELECT is((SELECT body->'profile'->>'age' FROM r)::int >= 26, true, 'age computed');
-- Non-existent / suspended target returns ok=false
SELECT is(
  (SELECT public.view_profile('00000000-0000-0000-0000-000000000000'::uuid))::text,
  '{"ok": false, "error": "not_found"}',
  'unknown profile returns not_found'
);

SELECT * FROM finish();
ROLLBACK;
