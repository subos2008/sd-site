BEGIN;
SELECT plan(13);

SELECT has_table('public', 'profiles', 'profiles table exists');
SELECT col_is_pk('public', 'profiles', 'id', 'profiles.id is PK');
SELECT col_type_is('public', 'profiles', 'id', 'uuid', 'profiles.id is uuid');

SELECT has_column('public', 'profiles', 'role',                 'role column');
SELECT has_column('public', 'profiles', 'display_name',         'display_name column');
SELECT has_column('public', 'profiles', 'date_of_birth',        'date_of_birth column');
SELECT has_column('public', 'profiles', 'status',               'status column');
SELECT has_column('public', 'profiles', 'token_balance',        'token_balance column');
SELECT has_column('public',   'profiles', 'place_id',          'place_id column');
SELECT hasnt_column('public', 'profiles', 'city_display_name', 'legacy city_display_name dropped');
SELECT hasnt_column('public', 'profiles', 'city_lat',          'legacy city_lat dropped');
SELECT hasnt_column('public', 'profiles', 'city_lng',          'legacy city_lng dropped');

-- DOB ≥ 18 CHECK: inserting a 17-year-old DOB must raise.
SELECT throws_ok(
  $$ INSERT INTO public.profiles (id, date_of_birth, status)
     VALUES (gen_random_uuid(), (now() - interval '17 years')::date, 'pending_onboarding') $$,
  '23514',
  NULL,
  'CHECK constraint rejects under-18 DOB'
);

SELECT * FROM finish();
ROLLBACK;
