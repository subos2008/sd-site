BEGIN;
SELECT plan(3);

INSERT INTO public.places (id, name, display_name, country_code, admin1_name, lat, lng, population, feature_class, feature_code, radius_miles) VALUES
  (900000010, 'Placetown', 'Placetown, England', 'GB', 'England', 53.48, -2.24, 500000, 'P', 'PPL', 5);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000',
        'placeloc-test@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated',
        now(), now(), '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '88888888-8888-8888-8888-888888888888';

SELECT is(
  (SELECT public.set_profile_location(900000010::bigint))::text,
  '{"ok": true}',
  'happy path returns ok');

SELECT is(
  (SELECT place_id FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888888'),
  900000010::bigint,
  'place_id persisted');

SELECT is(
  (SELECT public.set_profile_location(123456789012::bigint))::text,
  '{"ok": false, "error": "place_not_found"}',
  'unknown place rejected');

SELECT * FROM finish();
ROLLBACK;
