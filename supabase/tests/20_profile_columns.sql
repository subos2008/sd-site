BEGIN;
SELECT plan(17);

-- Fixture: insert auth.users row; the handle_new_user trigger from Plan 02
-- auto-creates a matching public.profiles row.
INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', '00000000-0000-0000-0000-000000000000',
        'pcol@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
        '', '', '');

SELECT has_column('public', 'profiles', 'tagline',             'tagline column');
SELECT has_column('public', 'profiles', 'about',               'about column');
SELECT has_column('public', 'profiles', 'wants',               'wants column');
SELECT has_column('public', 'profiles', 'height_cm',           'height_cm column');
SELECT has_column('public', 'profiles', 'body_type',           'body_type column');
SELECT has_column('public', 'profiles', 'ethnicity',           'ethnicity column');
SELECT has_column('public', 'profiles', 'hair_color',          'hair_color column');
SELECT has_column('public', 'profiles', 'eye_color',           'eye_color column');
SELECT has_column('public', 'profiles', 'has_piercings',       'has_piercings column');
SELECT has_column('public', 'profiles', 'has_tattoos',         'has_tattoos column');
SELECT has_column('public', 'profiles', 'smoking',             'smoking column');
SELECT has_column('public', 'profiles', 'drinking',            'drinking column');
SELECT has_column('public', 'profiles', 'education',           'education column');
SELECT has_column('public', 'profiles', 'yearly_income_band',  'yearly_income_band column');
SELECT has_column('public', 'profiles', 'net_worth_band',      'net_worth_band column');

-- height_cm CHECK (reasonable bounds 120..240)
SELECT throws_ok(
  $$ UPDATE public.profiles SET height_cm = 50 WHERE id = (SELECT id FROM public.profiles LIMIT 1) $$,
  '23514', NULL,
  'height_cm < 120 rejected'
);

-- tagline length CHECK (1..120)
SELECT throws_ok(
  $$ UPDATE public.profiles SET tagline = repeat('x', 121) WHERE id = (SELECT id FROM public.profiles LIMIT 1) $$,
  '23514', NULL,
  'tagline > 120 chars rejected'
);

SELECT * FROM finish();
ROLLBACK;
