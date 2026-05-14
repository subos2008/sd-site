BEGIN;
SELECT plan(4);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000',
        'loc-test@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '66666666-6666-6666-6666-666666666666';

SELECT is(
  (SELECT public.set_profile_location('Manchester, Greater Manchester', 53.4808, -2.2426))::text,
  '{"ok": true}',
  'happy path returns ok'
);

SELECT is(
  (SELECT city_display_name FROM public.profiles WHERE id = '66666666-6666-6666-6666-666666666666'),
  'Manchester, Greater Manchester',
  'city_display_name persisted'
);

-- Out-of-range lat rejected
SELECT is(
  (SELECT public.set_profile_location('Bad', 91.0, 0.0))::text,
  '{"ok": false, "error": "lat_out_of_range"}',
  'lat > 90 rejected'
);

-- Empty display rejected
SELECT is(
  (SELECT public.set_profile_location('', 0.0, 0.0))::text,
  '{"ok": false, "error": "city_display_name_required"}',
  'empty city_display_name rejected'
);

SELECT * FROM finish();
ROLLBACK;
