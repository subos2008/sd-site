BEGIN;
SELECT plan(9);

-- Fixture user (baby). auth.users first, then impersonate.
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
        'baby-gate@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated',
        now(), now(), '', '', '');

INSERT INTO public.places (id, name, display_name, country_code, admin1_name, lat, lng, population, feature_class, feature_code, radius_miles) VALUES
  (900000040, 'Gateville', 'Gateville, England', 'GB', 'England', 51.5074, -0.1278, 100000, 'P', 'PPL', 3);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';

SELECT public.set_profile_role('baby');
SELECT public.set_profile_identity('Baby Gate', '1998-05-05'::date, 'female', 'male');
SELECT public.set_profile_location(900000040::bigint);

-- 1. No photos yet -> photos_required, status unchanged.
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "photos_required"}',
  'baby with zero photos rejected: photos_required'
);
SELECT is(
  (SELECT status::text FROM public.profiles WHERE id = '33333333-3333-3333-3333-333333333333'),
  'pending_onboarding',
  'status unchanged after photos_required'
);

-- Seed exactly babyMinPhotos photos (read count from app_config so the test tracks config).
-- Do this as postgres (RESET ROLE): media_items is deny-all / RPC-only for `authenticated`,
-- and postgres bypasses RLS, so we both seed and link the photos here rather than reading
-- media_items back as the owner (which the deny-all posture correctly forbids).
RESET ROLE;
INSERT INTO public.media_items (id, owner_id, storage_path, kind, hash, size_bytes, status)
SELECT gen_random_uuid(),
       '33333333-3333-3333-3333-333333333333',
       'users/33333333-3333-3333-3333-333333333333/p' || g || '.jpg',
       'photo', 'hash_baby_gate_' || g, 1024, 'approved'
FROM generate_series(
       1,
       (SELECT (value->>'babyMinPhotos')::int FROM public.app_config WHERE key = 'onboarding')
     ) g;
-- Link each seeded media item into profile_photos directly (postgres bypasses RLS).
INSERT INTO public.profile_photos (profile_id, media_item_id, ordinal)
SELECT owner_id, id, (row_number() OVER (ORDER BY hash)) - 1
FROM public.media_items
WHERE owner_id = '33333333-3333-3333-3333-333333333333';
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';

-- 2. Photos now sufficient, but no bio -> tagline_required.
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "tagline_required"}',
  'baby with photos but no tagline rejected: tagline_required'
);

-- 3. Tagline set, about missing -> about_required.
SELECT public.set_profile_bio('Sweet and curious', NULL, NULL);
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "about_required"}',
  'baby with tagline but no about rejected: about_required'
);

-- 4. about too short (below babyMinBioChars) -> about_required.
SELECT public.set_profile_bio('Sweet and curious', 'too short', NULL);
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "about_required"}',
  'baby with short about rejected: about_required'
);

-- 5. about ok, wants missing -> wants_required.
SELECT public.set_profile_bio(
  'Sweet and curious',
  'I offer genuine company, good conversation and a warm presence for a generous partner.',
  NULL
);
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "wants_required"}',
  'baby with about but no wants rejected: wants_required'
);

-- 6. Everything present -> ok, status active.
SELECT public.set_profile_bio(
  'Sweet and curious',
  'I offer genuine company, good conversation and a warm presence for a generous partner.',
  'Looking for a respectful, established partner who values discretion and kindness.'
);
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": true}',
  'baby with all requirements met activates'
);
SELECT is(
  (SELECT status::text FROM public.profiles WHERE id = '33333333-3333-3333-3333-333333333333'),
  'active',
  'baby status transitioned to active'
);

-- 7. Second call now that status is active -> not_pending_onboarding.
SELECT is(
  (SELECT public.complete_onboarding())::text,
  '{"ok": false, "error": "not_pending_onboarding"}',
  'already-active baby cannot re-complete'
);

SELECT * FROM finish();
ROLLBACK;
