BEGIN;
SELECT plan(4);

INSERT INTO auth.users (id, instance_id, email, raw_app_meta_data, raw_user_meta_data,
                        aud, role, created_at, updated_at,
                        confirmation_token, email_change_token_new, recovery_token)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab01', '00000000-0000-0000-0000-000000000000',
   'lt1@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab02', '00000000-0000-0000-0000-000000000000',
   'lt2@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', ''),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab03', '00000000-0000-0000-0000-000000000000',
   'lt3@local.test', '{}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated', now(), now(),
   '', '', '');

UPDATE public.profiles SET role='benefactor', status='active', display_name='Me',
       date_of_birth='1985-01-01', city_lat=51.5, city_lng=-0.1, city_display_name='London'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab01';
UPDATE public.profiles SET role='baby', status='active', display_name='LikedMe',
       date_of_birth='1998-01-01', city_lat=51.5, city_lng=-0.1, city_display_name='London'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab02';
UPDATE public.profiles SET role='baby', status='active', display_name='MyFav',
       date_of_birth='1996-01-01', city_lat=51.5, city_lng=-0.1, city_display_name='London'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab03';

-- Seed: lt2 likes me; I like lt3 (direct INSERT as superuser to avoid RPC notification side effects)
INSERT INTO public.likes (liker_id, likee_id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab02', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab01'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab03');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaab01';

WITH r AS (SELECT public.view_likes_tab() AS body)
SELECT is(
  (SELECT body->>'ok' FROM r),
  'true',
  'view_likes_tab ok'
);

WITH r AS (SELECT public.view_likes_tab() AS body)
SELECT is(
  jsonb_array_length((SELECT body->'liked_me' FROM r)),
  1,
  '1 liked_me entry'
);

WITH r AS (SELECT public.view_likes_tab() AS body)
SELECT is(
  (SELECT body->'liked_me'->0->>'display_name' FROM r),
  'LikedMe',
  'liked_me contains LikedMe'
);

WITH r AS (SELECT public.view_likes_tab() AS body)
SELECT is(
  (SELECT body->'favourites'->0->>'display_name' FROM r),
  'MyFav',
  'favourites contains MyFav'
);

SELECT * FROM finish();
ROLLBACK;
